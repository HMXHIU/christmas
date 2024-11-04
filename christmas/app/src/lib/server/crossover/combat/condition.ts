import type { BodyPart, DieRoll } from "$lib/crossover/types";
import { getEntityId, minifiedEntity } from "$lib/crossover/utils";
import {
    conditions,
    expireConditions,
    physicalDamageTypes,
    type Condition,
    type DamageType,
} from "$lib/crossover/world/combat";
import { MS_PER_TURN } from "$lib/crossover/world/settings";
import { clone } from "lodash-es";
import { resolveCombatConsequences } from ".";
import { publishAffectedEntitiesToPlayers } from "../events";
import { itemRepository, monsterRepository, playerRepository } from "../redis";
import { getPlayerIdsNearbyEntities } from "../redis/queries";
import { fetchEntity, saveEntity } from "../redis/utils";

import type {
    ActorEntity,
    ItemEntity,
    MonsterEntity,
    PlayerEntity,
} from "../types";
import { resolveDamage, rollDiceWithModifier } from "./utils";

export {
    activeConditions,
    hasCondition,
    popCondition,
    processActiveConditions,
    pushCondition,
    resolveConditionsFromDamage,
};

async function processActiveConditions() {
    const now = Date.now();

    // TODO: use pagination

    // Fetch all entities with active conditions
    const players = (await playerRepository
        .search()
        .where("cond")
        .containsOneOf("a:*")
        .returnAll()) as PlayerEntity[];

    const monsters = (await monsterRepository
        .search()
        .where("cond")
        .containsOneOf("a:*")
        .returnAll()) as MonsterEntity[];

    const items = (await itemRepository
        .search()
        .where("cond")
        .containsOneOf("a:*")
        .returnAll()) as ItemEntity[];

    for (let defender of [...players, ...monsters, ...items]) {
        for (const s of activeConditions(defender.cond, now)) {
            const [active, cond, end, attackerId] = s.split(":");
            const dot = conditions[cond as Condition].dot;
            if (dot) {
                const attacker = await fetchEntity(attackerId);
                if (attacker) {
                    const attackerBefore = clone(attacker);
                    const defenderBefore = clone(defender);

                    let { defender: affectedDefender } = await resolveDamage({
                        attacker,
                        defender,
                        dieRoll: dot,
                    });

                    // Inform all players nearby
                    await publishAffectedEntitiesToPlayers(
                        [
                            minifiedEntity(affectedDefender, {
                                stats: true,
                            }),
                        ],
                        {
                            publishTo:
                                await getPlayerIdsNearbyEntities(
                                    affectedDefender,
                                ),
                            op: "upsert",
                        },
                    );

                    // Expire conditions
                    affectedDefender.cond = expireConditions(
                        affectedDefender.cond,
                    );
                    affectedDefender = await saveEntity(affectedDefender);

                    // Resolve combat consequences
                    await resolveCombatConsequences({
                        attackerBefore,
                        attacker,
                        defenderBefore,
                        defender,
                    });
                }
            }
        }
    }
}

/**
 * At this point player is already hit (failed to evade), this roll is to resist conditions
 *
 * TODO: use damage to factor in the resistance roll difficulty
 */
function resolveConditionsFromDamage({
    defender,
    attacker,
    bodyPart,
    damage,
    damageType,
    now,
}: {
    defender: ActorEntity;
    attacker: ActorEntity;
    damage: number;
    damageType: DamageType;
    bodyPart?: BodyPart;
    now?: number;
}): ActorEntity {
    now = now ?? Date.now();

    // Physical damage (con modifier)
    if (physicalDamageTypes.has(damageType)) {
        // Roll for resistance
        const dieRoll: DieRoll = {
            count: 1,
            sides: 20,
            modifiers: ["con"],
        };
        if (
            rollDiceWithModifier(dieRoll, attacker) <
            rollDiceWithModifier(dieRoll, defender)
        ) {
            return defender;
        }

        if (bodyPart === "arms") {
            defender.cond = pushCondition(
                defender.cond,
                "weakness",
                attacker,
                now,
            );
        } else if (bodyPart === "legs") {
            defender.cond = pushCondition(
                defender.cond,
                "crippled",
                attacker,
                now,
            );
        } else if (bodyPart === "head") {
            defender.cond = pushCondition(
                defender.cond,
                "stunned",
                attacker,
                now,
            );
        }
    }
    // Elemental damage (cha modifier)
    else {
        // Roll for resistance
        const dieRoll: DieRoll = {
            count: 1,
            sides: 20,
            modifiers: ["cha"],
        };
        if (
            rollDiceWithModifier(dieRoll, attacker) <
            rollDiceWithModifier(dieRoll, defender)
        ) {
            return defender;
        }
        // Fire - burning
        if (damageType === "fire") {
            defender.cond = pushCondition(
                defender.cond,
                "burning",
                attacker,
                now,
            );
        }
        // Water - wet
        else if (damageType === "water") {
            defender.cond = pushCondition(defender.cond, "wet", attacker, now);
        }
        // Lightning - paralyed
        else if (damageType === "lightning") {
            defender.cond = pushCondition(
                defender.cond,
                "paralyzed",
                attacker,
                now,
            );
        }
        // Ice - frozen
        else if (damageType === "ice") {
            defender.cond = pushCondition(
                defender.cond,
                "frozen",
                attacker,
                now,
            );
        }
    }

    return defender;
}

function pushCondition(
    conds: string[],
    condition: Condition,
    attacker: ActorEntity,
    now?: number,
): string[] {
    now = now ?? Date.now();
    const { active, turns } = conditions[condition];
    return [
        `${active ? "a" : "p"}:${condition}:${now + MS_PER_TURN * turns}:${getEntityId(attacker)[0]}`,
        ...popCondition(conds, condition, now), // also removes expired conditions
    ];
}

function popCondition(
    conds: string[],
    condition: Condition,
    now?: number,
): string[] {
    now = now ?? Date.now();
    return conds.filter((s) => {
        const [active, cond, end] = s.split(":");
        return Number(end) > now && cond !== condition; // also removes expired conditions
    });
}

function hasCondition(
    conds: string[],
    condition: Condition,
    now?: number,
): boolean {
    now = now ?? Date.now();
    return conds.some((s) => {
        const [active, cond, end] = s.split(":");
        return cond === condition && Number(end) > now;
    });
}

function activeConditions(conds: string[], now?: number): string[] {
    now = now ?? Date.now();
    return conds.filter((s) => {
        const [active, cond, end] = s.split(":");
        return Number(end) > now && active === "a";
    });
}

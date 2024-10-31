import type { BodyPart, DieRoll } from "$lib/crossover/types";
import {
    calculateLocation,
    entityDimensions,
    getEntityId,
    minifiedEntity,
} from "$lib/crossover/utils";
import type {
    Abilities,
    ProcedureEffect,
} from "$lib/crossover/world/abilities";
import type { Actions } from "$lib/crossover/world/actions";
import { type DamageType } from "$lib/crossover/world/combat";
import { compendium } from "$lib/crossover/world/settings/compendium";
import type {
    ActorEntity,
    CreatureEntity,
    ItemEntity,
    MonsterEntity,
    PlayerEntity,
} from "$lib/server/crossover/types";
import { clone, uniq } from "lodash-es";
import { awardKillCurrency } from "../entity";
import {
    publishActionEvent,
    publishAffectedEntitiesToPlayers,
    publishFeedEvent,
    publishFeedEventToPlayers,
} from "../events";
import { resolvePlayerQuests } from "../quests";
import {
    equipmentQuerySet,
    getPlayerIdsNearbyEntities,
} from "../redis/queries";
import { saveEntities } from "../redis/utils";
import {
    popCondition,
    pushCondition,
    resolveConditionsFromDamage,
} from "./condition";
import {
    entityPronoun,
    generateHitMessage,
    generateMissMessage,
} from "./dialogues";
import {
    attackRollForProcedureEffect,
    attackRollForWeapon,
    d4,
    determineBodyPartHit,
    determineEquipmentSlotHit,
    entityDied,
    resolveDamage,
    respawnPlayer,
} from "./utils";

export {
    resolveAttack,
    resolveCombat,
    resolveCombatConsequences,
    resolveProcedureEffect,
};

const deadMessage = `As your vision fades, a cold darkness envelops your senses.
You feel weightless, adrift in a void between life and death.
Time seems meaningless here, yet you sense that you are bound—unable to move, unable to act.
But something tells you that this is not the end.`;

async function resolveCombat(
    attacker: ActorEntity,
    defender: ActorEntity,
    options: {
        attack?: {
            action: Actions;
            weapon?: ItemEntity;
        };
        ability?: {
            procedureEffect: ProcedureEffect;
            ability: Abilities;
        };
    },
): Promise<{
    attacker: ActorEntity;
    defender: ActorEntity;
    affectedEntities: ActorEntity[];
    success: boolean;
}> {
    const attackerBefore = clone(attacker);
    const defenderBefore = clone(defender);

    let success = false;
    let affectedEntities: ActorEntity[] = [];
    let bodyPartHit: BodyPart | undefined = undefined;
    let damage: number | undefined = undefined;
    let damageType: DamageType | undefined = undefined;

    // Inform all players nearby
    const nearbyPlayerIds = await getPlayerIdsNearbyEntities(
        attacker,
        defender,
    );

    // Attack
    if (options.attack) {
        ({
            success,
            affectedEntities,
            damage,
            bodyPartHit,
            damageType,
            attacker,
            defender,
        } = await resolveAttack(attacker, defender, options.attack.weapon));

        // Publish action feed
        await publishActionEvent(nearbyPlayerIds, {
            action: success ? "attack" : "miss",
            source: getEntityId(attacker)[0],
            target: getEntityId(defender)[0],
        });
    }
    // Ability's procedure effect
    else if (options.ability?.procedureEffect) {
        ({
            success,
            affectedEntities,
            damage,
            bodyPartHit,
            damageType,
            attacker,
            defender,
        } = await resolveProcedureEffect(
            attacker,
            defender,
            options.ability?.procedureEffect,
        ));

        // Publish action feed
        await publishActionEvent(nearbyPlayerIds, {
            ability: options?.ability.ability,
            source: getEntityId(attacker)[0],
            target: getEntityId(defender)[0],
        });
    }

    // Hit
    if (success) {
        // Resolve conditions from hit
        if (damage && damageType) {
            defender = resolveConditionsFromDamage({
                defender,
                attacker,
                bodyPartHit,
                damage,
                damageType,
            });
        }

        // Publish entities
        await publishAffectedEntitiesToPlayers(
            affectedEntities.map((e) =>
                minifiedEntity(e, {
                    stats: true,
                    timers: true,
                }),
            ),
            {
                publishTo: nearbyPlayerIds,
                op: "upsert",
            },
        );
        // Publish hit feed
        await publishFeedEventToPlayers(nearbyPlayerIds, {
            type: "message",
            message: generateHitMessage({
                attacker,
                target: defender,
                weapon: options.attack?.weapon,
                ability: options.ability?.ability,
                bodyPartHit: bodyPartHit ?? "torso",
                damage,
                damageType,
            }),
        });
    }
    // Miss
    else {
        // Publish miss feed
        await publishFeedEventToPlayers(nearbyPlayerIds, {
            type: "message",
            message: generateMissMessage(
                attacker,
                defender,
                options.attack?.weapon,
            ),
        });
    }

    // Save entities
    await saveEntities(...affectedEntities);

    // Resolve combat consequences
    ({ attacker, defender } = await resolveCombatConsequences({
        attackerBefore,
        attacker,
        defenderBefore,
        defender,
    }));

    return { success, attacker, defender, affectedEntities };
}

async function resolveAttack(
    attacker: ActorEntity,
    defender: ActorEntity,
    weapon?: ItemEntity,
): Promise<{
    success: boolean;
    bodyPartHit?: BodyPart;
    damage?: number;
    damageType: DamageType;
    affectedEntities: ActorEntity[];
    attacker: ActorEntity;
    defender: ActorEntity;
}> {
    const affectedEntities: ActorEntity[] = []; // affected entities
    let success = false;
    let bodyPartHit: BodyPart | undefined = undefined;
    let damage: number | undefined = undefined;
    let damageType: DamageType = "normal";

    // Attack roll
    success = attackRollForWeapon(attacker, defender, weapon).success;
    if (success) {
        // Body part roll
        bodyPartHit = determineBodyPartHit();

        // Get corresponding equipment from bodyPartHit
        const equipmentSlot = determineEquipmentSlotHit(bodyPartHit);
        const equipment = (await equipmentQuerySet(getEntityId(defender)[0], [
            equipmentSlot,
        ]).first()) as ItemEntity;

        // Damage
        const dieRoll: DieRoll = weapon
            ? (compendium[weapon.prop].dieRoll ?? d4)
            : d4;
        ({ damage, attacker, defender } = resolveDamage({
            attacker,
            defender,
            bodyPartHit,
            dieRoll,
            equipment,
        }));
        affectedEntities.push(defender);

        // Reduce attacker item durability
        if (weapon) {
            weapon.dur -= 1;
            affectedEntities.push(weapon);
        }

        // Reduce defender equipment durability
        if (equipment) {
            (equipment as ItemEntity).dur -= 1;
            affectedEntities.push(equipment as ItemEntity);
        }
    }
    return {
        success,
        affectedEntities,
        bodyPartHit,
        damage,
        damageType,
        attacker,
        defender,
    };
}

async function resolveProcedureEffect(
    attacker: ActorEntity,
    defender: ActorEntity,
    procedureEffect: ProcedureEffect,
    now?: number,
): Promise<{
    success: boolean;
    bodyPartHit?: BodyPart;
    damage?: number;
    damageType?: DamageType;
    affectedEntities: ActorEntity[];
    attacker: ActorEntity;
    defender: ActorEntity;
}> {
    const affectedEntities: ActorEntity[] = [];
    let success = false;
    let damage: number | undefined = undefined;
    let bodyPartHit: BodyPart | undefined = undefined;
    let damageType: DamageType | undefined = undefined;

    // Attack roll
    if (attacker === defender) {
        success = true; // target self always succeed
    } else {
        success = attackRollForProcedureEffect(
            attacker,
            defender,
            procedureEffect,
        ).success;
    }

    if (success) {
        // Damaging ability
        if (procedureEffect.dieRoll) {
            // Body part roll
            bodyPartHit = determineBodyPartHit();
            const equipmentSlot = determineEquipmentSlotHit(bodyPartHit);
            const equipment = (await equipmentQuerySet(
                getEntityId(defender)[0],
                [equipmentSlot],
            ).first()) as ItemEntity;

            // Abilities ignore debuffs from body part hits
            ({ damage, attacker, defender, damageType } = resolveDamage({
                attacker,
                defender,
                bodyPartHit,
                equipment,
                dieRoll: procedureEffect.dieRoll,
            }));
            affectedEntities.push(defender);

            // Reduce defender equipment durability
            if (equipment) {
                (equipment as ItemEntity).dur -= 1;
                affectedEntities.push(equipment as ItemEntity);
            }
        }

        // Condition (buff/debuff) ability
        if (procedureEffect.conditions) {
            const { condition, op } = procedureEffect.conditions;
            if (op === "push") {
                defender.cond = pushCondition(
                    defender.cond,
                    condition,
                    attacker,
                    now,
                );
            } else if (op === "pop") {
                defender.cond = popCondition(defender.cond, condition);
            }
            affectedEntities.push(defender);
        }

        // State change ability
        if (procedureEffect.states) {
            for (const [state, { op, value }] of Object.entries(
                procedureEffect.states,
            )) {
                if (defender.hasOwnProperty(state)) {
                    if (op === "change") {
                        (defender as any)[state] = value;
                    } else if (op === "subtract" && state) {
                        (defender as any)[state] -= value as number;
                    } else if (op === "add") {
                        (defender as any)[state] += value as number;
                    }
                    // Patch location (if the location dimensions have changed beyond the asset's dimensions)
                    if (state === "loc") {
                        const { width, height } = entityDimensions(defender);
                        if (defender[state].length !== width * height) {
                            defender[state] = calculateLocation(
                                defender[state][0],
                                width,
                                height,
                            );
                        }
                    }
                    affectedEntities.push(defender);
                }
            }
        }
    }

    return {
        success,
        affectedEntities: uniq(affectedEntities),
        damage,
        bodyPartHit,
        damageType,
        attacker,
        defender,
    };
}

async function resolveCombatConsequences({
    attackerBefore,
    defenderBefore,
    attacker,
    defender,
}: {
    attackerBefore: ActorEntity;
    defenderBefore: ActorEntity;
    attacker: ActorEntity;
    defender: ActorEntity;
}): Promise<{
    attacker: ActorEntity;
    defender: ActorEntity;
}> {
    // Defender killed attacker
    if (entityDied(attackerBefore, attacker)) {
        ({ attacker, defender } = await handleEntityDeath(
            attacker,
            defender as CreatureEntity,
            true,
        ));
        if (defender.player && !("item" in attacker)) {
            await handleQuestTrigger(attacker, defender as PlayerEntity);
        }
    }

    // Attacker killed defender
    if (entityDied(defenderBefore, defender)) {
        ({ attacker, defender } = await handleEntityDeath(
            defender as CreatureEntity,
            attacker,
            false,
        ));
        if (attacker.player && !("item" in defender)) {
            await handleQuestTrigger(defender, attacker as PlayerEntity);
        }
    }

    return { attacker, defender };
}

async function handleQuestTrigger(
    deadEntity: CreatureEntity,
    killerEntity: PlayerEntity,
) {
    // Get quest entities
    const questEntities =
        "monster" in deadEntity
            ? [
                  (deadEntity as MonsterEntity).monster,
                  (deadEntity as MonsterEntity).beast,
              ]
            : [(deadEntity as PlayerEntity).player];

    // Resolve any kill quest triggers
    await resolvePlayerQuests(
        killerEntity as PlayerEntity,
        questEntities,
        (trigger) => {
            if (
                trigger.type === "kill" &&
                questEntities.includes(trigger.entity)
            ) {
                return true;
            }
            return false;
        },
    );
}

async function handleEntityDeath(
    deadEntity: ActorEntity,
    killerEntity: ActorEntity,
    isAttacker: boolean, // dead entity is attacker
) {
    // Award currency to killer
    if (!("item" in killerEntity) && !("item" in deadEntity)) {
        killerEntity = await awardKillCurrency(
            killerEntity as CreatureEntity,
            deadEntity as CreatureEntity,
        );
        await publishAffectedEntitiesToPlayers(
            [
                minifiedEntity(killerEntity, {
                    stats: true,

                    timers: true,
                }),
            ],
            { op: "upsert" },
        );
    }

    // Respawn dead player
    if (deadEntity.player) {
        deadEntity = await respawnPlayer(deadEntity as PlayerEntity);
        await publishFeedEvent(deadEntity.player, {
            type: "message",
            message: deadMessage,
        });
        await publishAffectedEntitiesToPlayers(
            [
                minifiedEntity(deadEntity, {
                    stats: true,

                    timers: true,
                }),
            ],
            { op: "upsert" },
        );
    }

    // Publish 'You killed' message to killer player (TODO: custom death message for each beast)
    if (killerEntity.player) {
        const message = !("item" in deadEntity)
            ? `You killed ${deadEntity.name}, ${entityPronoun(deadEntity, "object")} collapses at your feet.`
            : `You destroyed ${deadEntity.name}`;

        await publishFeedEvent((killerEntity as PlayerEntity).player, {
            type: "message",
            message,
        });
    }

    return isAttacker
        ? { attacker: deadEntity, defender: killerEntity }
        : { attacker: killerEntity, defender: deadEntity };
}

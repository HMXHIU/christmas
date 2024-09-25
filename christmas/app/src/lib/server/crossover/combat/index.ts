import type {
    BodyPart,
    DieRoll,
    GameRedisEntities,
    ItemEntity,
    MonsterEntity,
    PlayerEntity,
} from "$lib/crossover/types";
import {
    calculateLocation,
    entityDimensions,
    getEntityId,
    minifiedEntity,
} from "$lib/crossover/utils";
import type {
    Abilities,
    DamageType,
    ProcedureEffect,
} from "$lib/crossover/world/abilities";
import type { Actions } from "$lib/crossover/world/actions";
import { compendium } from "$lib/crossover/world/settings/compendium";
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
    resolveDamageEffects,
    respawnPlayer,
} from "./utils";

export { resolveAttack, resolveCombat, resolveProcedureEffect };

const deadMessage = `As your vision fades, a cold darkness envelops your senses.
You feel weightless, adrift in a void between life and death.
Time seems meaningless here, yet you sense that you are bound—unable to move, unable to act.
But something tells you that this is not the end.`;

async function resolveCombat(
    attacker: PlayerEntity | MonsterEntity,
    defender: PlayerEntity | MonsterEntity | ItemEntity,
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
    attacker: PlayerEntity | MonsterEntity;
    defender: PlayerEntity | MonsterEntity | ItemEntity;
    entities: GameRedisEntities[];
    success: boolean;
}> {
    const attackerBefore = clone(attacker);
    const defenderBefore = clone(defender);

    let success = false;
    let entities: GameRedisEntities[] = [];
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
            entities,
            damage,
            bodyPartHit,
            damageType,
            attacker,
            defender,
        } = await resolveAttack(
            attacker,
            defender,
            "attack",
            options.attack.weapon,
        ));

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
            entities,
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

    // Save entities
    await saveEntities(attacker, defender, ...entities);

    // Hit
    if (success) {
        // Publish entities
        await publishAffectedEntitiesToPlayers(
            entities.map((e) =>
                minifiedEntity(e, {
                    stats: true,
                    timers: true,
                    location: true,
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

    // Resolve combat consequences
    ({ attacker, defender } = await resolveCombatConsequences({
        attackerBefore,
        attacker,
        defenderBefore,
        defender,
    }));

    return { success, attacker, defender, entities };
}

async function resolveAttack(
    attacker: PlayerEntity | MonsterEntity,
    defender: PlayerEntity | MonsterEntity | ItemEntity,
    action: Actions,
    weapon?: ItemEntity,
): Promise<{
    success: boolean;
    bodyPartHit?: BodyPart;
    damage?: number;
    damageType: DamageType;
    entities: GameRedisEntities[];
    attacker: PlayerEntity | MonsterEntity;
    defender: PlayerEntity | MonsterEntity | ItemEntity;
}> {
    const entities: GameRedisEntities[] = []; // affected entities
    let success = false;
    let bodyPartHit: BodyPart | undefined = undefined;
    let damage: number | undefined = undefined;
    let damageType: DamageType = "normal";

    // Attack action
    if (action === "attack") {
        // Attack roll
        success = attackRollForWeapon(attacker, defender, weapon).success;
        if (success) {
            // Body part roll
            bodyPartHit = determineBodyPartHit();
            const equipmentSlot = determineEquipmentSlotHit(bodyPartHit);

            // Damage & Debuffs
            const dieRoll: DieRoll = weapon
                ? compendium[weapon.prop].dieRoll ?? d4
                : d4;
            ({ damage, attacker, defender } = resolveDamageEffects(
                attacker,
                defender,
                bodyPartHit,
                dieRoll,
            ));
            entities.push(defender);

            // Reduce attacker item durability
            if (weapon) {
                weapon.dur -= 1;
                entities.push(weapon);
            }

            // Reduce defender equipment durability
            const equipment = await equipmentQuerySet(
                getEntityId(defender)[0],
                [equipmentSlot],
            ).first();
            if (equipment) {
                (equipment as ItemEntity).dur -= 1;
                entities.push(equipment as ItemEntity);
            }
        }
    }
    return {
        success,
        entities,
        bodyPartHit,
        damage,
        damageType,
        attacker,
        defender,
    };
}

async function resolveProcedureEffect(
    attacker: PlayerEntity | MonsterEntity,
    defender: PlayerEntity | MonsterEntity | ItemEntity,
    procedureEffect: ProcedureEffect,
): Promise<{
    success: boolean;
    bodyPartHit?: BodyPart;
    damage?: number;
    damageType?: DamageType;
    entities: GameRedisEntities[];
    attacker: PlayerEntity | MonsterEntity;
    defender: PlayerEntity | MonsterEntity | ItemEntity;
}> {
    const entities: GameRedisEntities[] = []; // affected entities
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

            // Abilities ignore debuffs from body part hits
            ({ damage, attacker, defender, damageType } = resolveDamageEffects(
                attacker,
                defender,
                bodyPartHit,
                procedureEffect.dieRoll,
            ));
            entities.push(defender);

            // Reduce defender equipment durability
            const equipment = await equipmentQuerySet(
                getEntityId(defender)[0],
                [equipmentSlot],
            ).first();
            if (equipment) {
                (equipment as ItemEntity).dur -= 1;
                entities.push(equipment as ItemEntity);
            }
        }

        // Debuff ability
        if (procedureEffect.debuffs) {
            const { debuff, op } = procedureEffect.debuffs;
            if (op === "push") {
                if (!defender.dbuf.includes(debuff)) {
                    defender.dbuf.push(debuff);
                }
            } else if (op === "pop") {
                defender.dbuf = defender.dbuf.filter((d) => d !== debuff);
            }
            entities.push(defender);
        }

        // Buff ability
        if (procedureEffect.buffs) {
            const { buff, op } = procedureEffect.buffs;
            if (op === "push" && !defender.buf.includes(buff)) {
                defender.buf.push(buff);
            } else if (op === "pop") {
                defender.buf = defender.buf.filter((d) => d !== buff);
            }
            entities.push(defender);
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
                    entities.push(defender);
                }
            }
        }
    }

    return {
        success,
        entities: uniq(entities),
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
    attackerBefore: PlayerEntity | MonsterEntity;
    defenderBefore: PlayerEntity | MonsterEntity | ItemEntity;
    attacker: PlayerEntity | MonsterEntity;
    defender: PlayerEntity | MonsterEntity | ItemEntity;
}): Promise<{
    attacker: PlayerEntity | MonsterEntity;
    defender: PlayerEntity | MonsterEntity | ItemEntity;
}> {
    // Defender killed attacker
    if (entityDied(attackerBefore, attacker)) {
        ({ attacker, defender } = await handleEntityDeath(
            attacker,
            defender as PlayerEntity | MonsterEntity,
            true,
        ));
        if (defender.player) {
            await handleQuestTrigger(attacker, defender as PlayerEntity);
        }
    }

    // Attacker killed defender
    if (entityDied(defenderBefore, defender)) {
        ({ attacker, defender } = await handleEntityDeath(
            defender as PlayerEntity | MonsterEntity,
            attacker,
            false,
        ));
        if (attacker.player) {
            await handleQuestTrigger(defender, attacker as PlayerEntity);
        }
    }

    return { attacker, defender };
}

async function handleQuestTrigger(
    deadEntity: PlayerEntity | MonsterEntity,
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
    deadEntity: PlayerEntity | MonsterEntity,
    killerEntity: PlayerEntity | MonsterEntity,
    isAttacker: boolean, // dead entity is attacker
) {
    // Award currency to killer
    if (killerEntity.player || killerEntity.monster) {
        killerEntity = await awardKillCurrency(
            killerEntity as PlayerEntity,
            deadEntity,
        );
        await publishAffectedEntitiesToPlayers(
            [
                minifiedEntity(killerEntity, {
                    stats: true,
                    location: true,
                    timers: true,
                }),
            ],
            { op: "upsert" },
        );
    }

    // Respawn dead player
    if (deadEntity.player) {
        deadEntity = respawnPlayer(deadEntity as PlayerEntity);
        await publishFeedEvent(deadEntity.player, {
            type: "message",
            message: deadMessage,
        });
        await publishAffectedEntitiesToPlayers(
            [
                minifiedEntity(deadEntity, {
                    stats: true,
                    location: true,
                    timers: true,
                }),
            ],
            { op: "upsert" },
        );
    }

    // Publish 'You killed' message to killer player
    if (killerEntity.player) {
        await publishFeedEvent((killerEntity as PlayerEntity).player, {
            type: "message",
            message: `You killed ${deadEntity.name}, ${entityPronoun(deadEntity, "object")} collapses at your feet.`,
        });
    }

    return isAttacker
        ? { attacker: deadEntity, defender: killerEntity }
        : { attacker: killerEntity, defender: deadEntity };
}

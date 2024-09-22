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
import { entityCurrencyReward } from "$lib/crossover/world/entity";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { clone, uniq } from "lodash-es";
import {
    publishActionEvent,
    publishAffectedEntitiesToPlayers,
    publishFeedEvent,
    publishFeedEventToPlayers,
} from "../events";
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

const deadMessage = `"As your vision fades, a cold darkness envelops your senses.
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
    let damageType: DamageType = "normal";

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
                bodyPartHit: bodyPartHit ?? "torso",
                damage: damage ?? 0,
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

    // Perform combat consequences
    ({ attacker, defender } = await resolveAfterCombat({
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
    damageType: DamageType;
    entities: GameRedisEntities[];
    attacker: PlayerEntity | MonsterEntity;
    defender: PlayerEntity | MonsterEntity | ItemEntity;
}> {
    const entities: GameRedisEntities[] = []; // affected entities
    let success = false;
    let damage: number | undefined = undefined;
    let bodyPartHit: BodyPart | undefined = undefined;
    let damageType: DamageType = "normal";

    // Attack roll
    success = attackRollForProcedureEffect(
        attacker,
        defender,
        procedureEffect,
    ).success;

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

async function resolveAfterCombat({
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
    // Attacker died
    if (entityDied(attackerBefore, attacker)) {
        // Award currency to defender if it is not item
        if ("player" in defender || "monster" in defender) {
            const { lum, umb } = entityCurrencyReward(attacker);
            (defender as PlayerEntity).lum += lum;
            (defender as PlayerEntity).umb += umb;
            // Publish entities
            await publishAffectedEntitiesToPlayers(
                [
                    minifiedEntity(defender, {
                        stats: true,
                        location: true,
                        timers: true,
                    }),
                ],
                {
                    op: "upsert",
                },
            );
        }
        // Respawn defender, publish dead message
        if ("player" in attacker) {
            attacker = respawnPlayer(attacker as PlayerEntity);
            await publishFeedEvent(attacker.player, {
                type: "message",
                message: deadMessage,
            });
            // Publish entities
            await publishAffectedEntitiesToPlayers(
                [
                    minifiedEntity(attacker, {
                        stats: true,
                        location: true,
                        timers: true,
                    }),
                ],
                {
                    op: "upsert",
                },
            );
        }
        // Publish killed feed
        if ("player" in defender) {
            await publishFeedEvent((defender as PlayerEntity).player, {
                type: "message",
                message: `You killed ${attacker.name}, ${entityPronoun(attacker)} collapses at your feet.`,
            });
        }
    }
    // Defender died
    if (entityDied(defenderBefore, defender)) {
        // Award currency to attacker if defender is not item
        if ("player" in defender || "monster" in defender) {
            const { lum, umb } = entityCurrencyReward(
                defender as PlayerEntity | MonsterEntity,
            );
            attacker.lum += lum;
            attacker.umb += umb;
            // Publish entities
            await publishAffectedEntitiesToPlayers(
                [
                    minifiedEntity(attacker, {
                        stats: true,
                        location: true,
                        timers: true,
                    }),
                ],
                {
                    op: "upsert",
                },
            );
        }
        // Respawn defender, publish dead message
        if ("player" in defender) {
            defender = respawnPlayer(defender as PlayerEntity);
            await publishFeedEvent(defender.player, {
                type: "message",
                message: deadMessage,
            });
            // Publish entities
            await publishAffectedEntitiesToPlayers(
                [
                    minifiedEntity(defender, {
                        stats: true,
                        location: true,
                        timers: true,
                    }),
                ],
                {
                    op: "upsert",
                },
            );
        }
        // Publish killed feed
        if ("player" in attacker) {
            await publishFeedEvent((attacker as PlayerEntity).player, {
                type: "message",
                message: `You killed ${defender.name}, ${entityPronoun(defender)} collapses at your feet.`,
            });
        }
    }

    return { attacker, defender };
}

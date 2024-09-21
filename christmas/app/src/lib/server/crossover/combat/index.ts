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
import { monsterLUReward } from "$lib/crossover/world/bestiary";
import { entityStats } from "$lib/crossover/world/entity";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { sanctuaries } from "$lib/crossover/world/settings/world";
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
import { saveEntities, saveEntity } from "../redis/utils";
import { generateHitMessage, generateMissMessage } from "./dialogues";
import {
    attackRollForProcedureEffect,
    attackRollForWeapon,
    d4,
    determineBodyPartHit,
    determineEquipmentSlotHit,
    resolveDamageEffects,
} from "./utils";

export { resolveAttack, resolveCombat, resolveProcedureEffect };

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
        publishActionEvent(nearbyPlayerIds, {
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
        publishActionEvent(nearbyPlayerIds, {
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
        publishAffectedEntitiesToPlayers(
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
        publishFeedEventToPlayers(nearbyPlayerIds, {
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
        publishFeedEventToPlayers(nearbyPlayerIds, {
            type: "message",
            message: generateMissMessage(
                attacker,
                defender,
                options.attack?.weapon,
            ),
        });
    }

    // Perform combat consequences
    await performCombatConsequences({
        selfBefore: attackerBefore,
        selfAfter: attacker,
        targetBefore: defenderBefore,
        targetAfter: defender,
        playersNearby: nearbyPlayerIds,
    });

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

/**
 * Handles the event when a player kills a monster.
 *
 * @param player - The player entity.
 * @param monster - The monster entity.
 */
async function handlePlayerKillsMonster(
    player: PlayerEntity,
    monster: MonsterEntity,
    playersNearby: string[],
) {
    // Note: changes player, monster in place

    // Give player rewards
    const { lum, umb } = monsterLUReward(monster);
    player.lum += lum;
    player.umb += umb;

    // Save & publish player
    player = await saveEntity(player);
    publishAffectedEntitiesToPlayers([player]);
}

/**
 * Handles the scenario where a monster kills a player.
 *
 * @param monster - The monster entity.
 * @param player - The player entity.
 */
async function handleMonsterKillsPlayer(
    monster: MonsterEntity,
    player: PlayerEntity,
    playersNearby: string[],
) {
    // Get player's sanctuary
    const sanctuary = sanctuaries.find((s) => s.region === player.rgn);
    if (!sanctuary) {
        throw new Error(`${player.player} has no sanctuary`);
    }

    player = {
        ...player,
        // Recover all stats
        ...entityStats(player),
        // Respawn at player's region
        loc: [sanctuary.geohash],
        locI: LOCATION_INSTANCE,
        locT: "geohash", // TODO: check sanctuary locT
        // Lose half exp
        umb: Math.floor(player.lum / 2),
        lum: Math.floor(player.umb / 2),
    };

    publishFeedEvent(player.player, {
        type: "message",
        message: "You died.",
    });
    // Save & publish player
    player = await saveEntity(player);
    publishAffectedEntitiesToPlayers([player], { publishTo: playersNearby });
}

async function performCombatConsequences({
    selfBefore,
    targetBefore,
    selfAfter,
    targetAfter,
    playersNearby,
}: {
    selfBefore: PlayerEntity | MonsterEntity;
    targetBefore: PlayerEntity | MonsterEntity | ItemEntity;
    selfAfter: PlayerEntity | MonsterEntity;
    targetAfter: PlayerEntity | MonsterEntity | ItemEntity;
    playersNearby: string[];
}): Promise<{
    self: PlayerEntity | MonsterEntity;
    target: PlayerEntity | MonsterEntity | ItemEntity;
}> {
    // Player initiated action
    if (selfBefore.player && selfBefore.player == selfAfter.player) {
        // Target is a player
        if (targetBefore.player && targetBefore.player == targetAfter.player) {
        }
        // Target is a monster
        else if (
            targetBefore.monster &&
            targetBefore.monster == targetAfter.monster
        ) {
            if (
                (targetBefore as MonsterEntity).hp > 0 &&
                (targetAfter as MonsterEntity).hp <= 0
            ) {
                await handlePlayerKillsMonster(
                    selfAfter as PlayerEntity,
                    targetAfter as MonsterEntity,
                    playersNearby,
                );
            }
        }
    }
    // Monster initiated action
    else if (selfBefore.monster && selfBefore.monster == selfAfter.monster) {
        // Target is a player
        if (targetBefore.player && targetBefore.player == targetAfter.player) {
            if (
                (targetBefore as PlayerEntity).hp > 0 &&
                (targetAfter as PlayerEntity).hp <= 0
            ) {
                await handleMonsterKillsPlayer(
                    selfAfter as MonsterEntity,
                    targetAfter as PlayerEntity,
                    playersNearby,
                );
            }
        }
        // Target is a monster
        else if (
            targetBefore.monster &&
            targetBefore.monster == targetAfter.monster
        ) {
        }
    }

    return { self: selfAfter, target: targetAfter };
}

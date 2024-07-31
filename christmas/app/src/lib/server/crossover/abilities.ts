import {
    calculateLocation,
    entityDimensions,
    entityInRange,
    getEntityId,
    minifiedEntity,
} from "$lib/crossover/utils";
import {
    abilities,
    hasResourcesForAbility,
    patchEffectWithVariables,
    type Abilities,
    type ProcedureEffect,
} from "$lib/crossover/world/abilities";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import { sleep } from "$lib/utils";
import { cloneDeep } from "lodash-es";
import {
    consumeResources,
    performActionConsequences,
    recoverAp,
    setEntityBusy,
} from ".";
import { fetchEntity, getNearbyPlayerIds, saveEntity } from "./redis";
import {
    type Item,
    type ItemEntity,
    type Monster,
    type MonsterEntity,
    type Player,
    type PlayerEntity,
} from "./redis/entities";
import {
    publishActionEvent,
    publishAffectedEntitiesToPlayers,
    publishFeedEvent,
} from "./utils";

export {
    consumeResources,
    performAbility,
    performEffectOnEntity,
    recoverAp,
    setEntityBusy,
};

async function performAbility({
    self,
    target,
    ability,
    ignoreCost,
    now,
}: {
    self: PlayerEntity | MonsterEntity; // self can only be a `player` or `monster`
    target: string;
    ability: string;
    ignoreCost?: boolean;
    now?: number;
}) {
    const [selfEntityId, selfEntityType] = getEntityId(self);

    // Get target
    let targetEntity = await fetchEntity(target);
    if (targetEntity == null) {
        if (self.player) {
            publishFeedEvent(selfEntityId, {
                type: "error",
                message: `Target ${target} not found`,
            });
        }
        return;
    }

    const { procedures, ap, mp, st, hp, range, predicate } = abilities[ability];

    // Recover AP
    self = await recoverAp(self);

    // Check if self has enough resources to perform ability
    if (!ignoreCost) {
        const { hasResources, message } = hasResourcesForAbility(self, ability);
        if (!hasResources && self.player) {
            publishFeedEvent(selfEntityId, {
                type: "error",
                message,
            });
            return;
        }
    }

    // Check predicate
    if (
        !predicate.targetSelfAllowed &&
        selfEntityId === target &&
        self.player
    ) {
        publishFeedEvent(selfEntityId, {
            type: "error",
            message: `You can't ${ability} yourself`,
        });
        return;
    }

    // Check if target is in range
    if (!entityInRange(self, targetEntity, range)[0] && self.player) {
        publishFeedEvent(selfEntityId, {
            type: "error",
            message: `Target is out of range`,
        });
        return;
    }

    // Set player busy
    self = await setEntityBusy({
        entity: self as PlayerEntity,
        ability,
        now,
    });

    // Save old self and target
    const selfBefore = cloneDeep(self);
    const targetBefore = cloneDeep(targetEntity);

    // Expend ability costs (also caps stats to player level)
    if (!ignoreCost) {
        self = await consumeResources(self, { ap, mp, st, hp });
    }
    targetEntity = targetEntity.player === self.player ? self : targetEntity; // target might be self, in which case update it after save

    // Publish ability costs changes to player
    if (self.player && !ignoreCost) {
        publishAffectedEntitiesToPlayers([
            minifiedEntity(self, { stats: true, timers: true }),
        ]);
    }

    // Get all players nearby self & target
    const playerIdsNearby = [];
    playerIdsNearby.push(...(await getNearbyPlayerIds(self.loc[0])));
    if (selfEntityId !== target) {
        playerIdsNearby.push(
            ...(await getNearbyPlayerIds(targetEntity.loc[0])),
        );
    }

    // Publish action event to all players nearby
    publishActionEvent(playerIdsNearby, {
        ability: ability as Abilities,
        source: selfEntityId,
        target,
    });

    // Perform procedures
    for (const [type, effect] of procedures) {
        // Get affected entity (self or target)
        let entity = effect.target === "self" ? self : targetEntity;

        // Action
        if (type === "action") {
            // Patch effect with variables
            const actualEffect = patchEffectWithVariables({
                effect,
                self,
                target: targetEntity,
            });

            // Perform effect action (will block for the duration (ticks) of the effect)
            entity = (await performEffectOnEntity({
                entity,
                effect: actualEffect,
            })) as PlayerEntity | MonsterEntity | ItemEntity;
            await saveEntity(entity);

            // Update self or target
            if (effect.target === "self") {
                self = entity as PlayerEntity | MonsterEntity;
            } else {
                targetEntity = entity as
                    | PlayerEntity
                    | MonsterEntity
                    | ItemEntity;
            }

            // Publish effect & effected entities to relevant players (include players nearby)
            publishAffectedEntitiesToPlayers(
                [self, targetEntity].map((e) =>
                    minifiedEntity(e, {
                        stats: true,
                        timers: true,
                        location: true,
                    }),
                ),
                {
                    publishTo: playerIdsNearby,
                },
            );
        }
        // Check
        else if (type === "check") {
            if (!performEffectCheck({ entity, effect })) break;
        }
    }

    // Perform action consequences
    await performActionConsequences({
        selfBefore,
        selfAfter: self,
        targetBefore,
        targetAfter: targetEntity,
        playersNearby: playerIdsNearby,
    });
}

async function performEffectOnEntity({
    entity,
    effect,
}: {
    entity: Player | Monster | Item;
    effect: ProcedureEffect;
}): Promise<Player | Monster | Item> {
    // Note: this will change entity in place

    // Sleep for the duration of the effect
    await sleep(effect.ticks * MS_PER_TICK);

    // Damage
    if (effect.damage) {
        // Player or monster
        if ((entity as Player).player || (entity as Monster).monster) {
            (entity as Player | Monster).hp = Math.max(
                0,
                (entity as Player | Monster).hp - effect.damage.amount,
            );
        }
        // Item
        else if ((entity as Item).item) {
            (entity as Item).dur = Math.max(
                0,
                (entity as Item).dur - effect.damage.amount,
            );
        }
    }

    // Debuff
    if (effect.debuffs) {
        const { debuff, op } = effect.debuffs;
        if (op === "push") {
            if (!entity.dbuf.includes(debuff)) {
                entity.dbuf.push(debuff);
            }
        } else if (op === "pop") {
            entity.dbuf = entity.dbuf.filter((d) => d !== debuff);
        }
    }

    // State
    if (effect.states) {
        const { state, op, value } = effect.states;
        if (entity.hasOwnProperty(state)) {
            if (op === "change") {
                (entity as any)[state] = value;
            } else if (op === "subtract" && state) {
                (entity as any)[state] -= value as number;
            } else if (op === "add") {
                (entity as any)[state] += value as number;
            }

            // Patch location (if the location dimensions have changed beyond the asset's dimensions)
            if (state === "loc") {
                const { width, height } = entityDimensions(entity);
                if (entity[state].length !== width * height) {
                    entity[state] = calculateLocation(
                        entity[state][0],
                        width,
                        height,
                    );
                }
            }
        }
    }

    return entity;
}

function performEffectCheck({
    entity,
    effect,
}: {
    entity: PlayerEntity | MonsterEntity | ItemEntity;
    effect: ProcedureEffect;
}): boolean {
    const { debuffs, buffs } = effect;

    if (debuffs) {
        const { debuff, op } = debuffs;
        if (op === "contains") {
            return entity.dbuf.includes(debuff);
        } else if (op === "doesNotContain") {
            return !entity.dbuf.includes(debuff);
        }
    }

    if (buffs) {
        const { buff, op } = buffs;
        if (op === "contains") {
            return entity.buf.includes(buff);
        } else if (op === "doesNotContain") {
            return !entity.buf.includes(buff);
        }
    }

    return false;
}

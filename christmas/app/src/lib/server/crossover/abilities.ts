import {
    entityInRange,
    getEntityId,
    minifiedEntity,
} from "$lib/crossover/utils";
import {
    hasResourcesForAbility,
    patchEffectWithVariables,
    type Abilities,
    type ProcedureEffect,
} from "$lib/crossover/world/abilities";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import { abilities } from "$lib/crossover/world/settings/abilities";
import type {
    ActorEntity,
    CreatureEntity,
    PlayerEntity,
} from "$lib/server/crossover/types";
import { sleep } from "$lib/utils";
import { consumeResources, setEntityBusy } from ".";
import { resolveCombat } from "./combat";
import { hasCondition } from "./combat/condition";
import { publishAffectedEntitiesToPlayers, publishFeedEvent } from "./events";

export { useAbility };

async function useAbility({
    self,
    target, // target can be undefined if the ability performs an action on self
    ability,
    ignoreCost,
    now,
}: {
    self: CreatureEntity;
    target?: ActorEntity;
    ability: Abilities;
    ignoreCost?: boolean;
    now?: number;
}) {
    // Set target to self if not provided
    target = target ?? self;

    // Check can use ability
    const [ok, error] = canUseAbility({
        self,
        target,
        ignoreCost,
        ability,
    });
    if (!ok) {
        if (self.player) {
            await publishFeedEvent((self as PlayerEntity).player, {
                type: "error",
                message: error,
            });
        }
        return; // do not proceed
    }

    // Set player busy
    self = await setEntityBusy({
        entity: self as PlayerEntity,
        ability,
        now,
    });

    const { procedures, cost } = abilities[ability];

    // Expend ability costs (also caps stats to player level)
    if (!ignoreCost) {
        self = await consumeResources(self, cost);
    }
    target = target.player === self.player ? self : target; // target might be self, in which case update it after save

    // Publish ability costs changes to player
    if (self.player && !ignoreCost) {
        await publishAffectedEntitiesToPlayers([
            minifiedEntity(self, { stats: true, timers: true }),
        ]);
    }

    // Perform procedures
    for (const [type, effect] of procedures) {
        // Get affected entity (self or target)
        let entity = effect.target === "self" ? self : target;

        // Action
        if (type === "action") {
            // Patch effect with variables
            const procedureEffect = patchEffectWithVariables({
                effect,
                self,
                target: target,
            });

            // Sleep for the duration of the effect
            await sleep(MS_PER_TICK * procedureEffect.ticks);

            // Resolve combat
            await resolveCombat(self, entity, {
                ability: {
                    ability,
                    procedureEffect,
                },
            });
        }
        // Check
        else if (type === "check") {
            if (!performEffectCheck({ entity, effect, now })) break;
        }
    }
}

function canUseAbility({
    self,
    ability,
    target,
    ignoreCost,
}: {
    self: CreatureEntity;
    ability: Abilities;
    target?: ActorEntity;
    ignoreCost?: boolean;
}): [boolean, string] {
    const { range, predicate } = abilities[ability];

    if (!target) {
        return [false, `Target not found`];
    }

    // Check if self has enough resources to perform ability
    if (!ignoreCost) {
        const { hasResources, message } = hasResourcesForAbility(self, ability);
        if (!hasResources) {
            return [false, message];
        }
    }

    // Check predicate
    if (
        !predicate.targetSelfAllowed &&
        getEntityId(self)[0] === getEntityId(target)[0] &&
        self.player
    ) {
        return [false, `You can't ${ability} yourself`];
    }

    // Check if target is in range
    if (!entityInRange(self, target, range)[0] && self.player) {
        return [false, `${target.name} is out of range`];
    }
    return [true, ""];
}

function performEffectCheck({
    entity,
    effect,
    now,
}: {
    entity: ActorEntity;
    effect: ProcedureEffect;
    now?: number;
}): boolean {
    if (effect.conditions) {
        const { condition, op } = effect.conditions;
        if (op === "contains") {
            return hasCondition(entity.cond, condition, now);
        } else if (op === "doesNotContain") {
            return !hasCondition(entity.cond, condition, now);
        }
    }
    return false;
}

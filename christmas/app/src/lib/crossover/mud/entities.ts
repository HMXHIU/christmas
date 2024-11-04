import { groupBy, mapValues, partition } from "lodash-es";
import type { Actor, EntityType, Item, Monster, Player } from "../types";
import { getEntityId, isEntityAlive } from "../utils";
import type { Genders } from "../world/demographic";
import { isHostile } from "../world/entity";
import { compendium } from "../world/settings/compendium";
import type { EntityDescriptionState, EntityDescriptors } from "./settings";

export {
    descibeEntities,
    entityLinguistics,
    entityPronouns,
    genderPronouns,
    type EntityLinguistics,
};

interface EntityLinguistics {
    subject: string;
    verb: {
        be: string;
        have: string;
    };
    pronoun: {
        possessive: string;
        reflexive: string;
        object: string;
        subject: string;
    };
}

function entityLinguistics(entity: Actor, selfId?: string): EntityLinguistics {
    const [entityId, entityType] = getEntityId(entity);
    return {
        subject: entityId === selfId ? "you" : entity.name,
        verb: entityVerbs(entity, selfId),
        pronoun: entityPronouns(entity, selfId),
    };
}

function entityVerbs(
    entity: Actor,
    selfId?: string,
): {
    be: string;
    have: string;
} {
    if (selfId && getEntityId(entity)[0] === selfId) {
        return {
            be: "are",
            have: "have",
        };
    } else {
        return {
            be: "is",
            have: "has",
        };
    }
}

function entityPronouns(
    entity: Actor,
    selfId?: string,
): {
    possessive: string;
    reflexive: string;
    object: string;
    subject: string;
} {
    if (selfId && getEntityId(entity)[0] === selfId) {
        return mapValues(genderPronouns, (v, k, o) => v.personal);
    } else if ("gen" in entity) {
        return mapValues(genderPronouns, (v, k, o) => v[entity.gen]);
    } else {
        return mapValues(genderPronouns, (v, k, o) => v.it);
    }
}

const genderPronouns: Record<
    "possessive" | "reflexive" | "object" | "subject",
    Record<Genders | "it" | "personal", string>
> = {
    possessive: {
        male: "his",
        female: "her",
        it: "its",
        personal: "your",
    },
    reflexive: {
        male: "himself",
        female: "herself",
        it: "itself",
        personal: "yourself",
    },
    object: {
        male: "he",
        female: "she",
        it: "it",
        personal: "you",
    },
    subject: {
        male: "him",
        female: "her",
        it: "it",
        personal: "you",
    },
};

function descibeEntities(
    player: Player,
    entities: Actor[],
    entityType: EntityType,
    entityDescriptors: Record<EntityType, EntityDescriptors>,
): string {
    // Seperate entities which are dead or destroyed
    const [aliveEntities, deadEntities] = partition(entities, isEntityAlive);

    function describeEntityGroup(
        entities: Actor[],
        entityState: EntityDescriptionState,
    ): string {
        const entitiesByCategory = groupBy(entities, (e) => {
            if (entityType === "item") return (e as Item).prop;
            if (entityType === "monster") return (e as Monster).beast;
            return "player"; // players are all considered a single category
        });

        const descriptions: string[] = [];
        for (const group of Object.values(entitiesByCategory)) {
            let description = applyEntityDescriptors(
                group,
                entityDescriptors[entityType],
                entityState,
            );
            // Don't add additional info if destroyed
            description += getAdditionalInfo(player, group, entityType);
            description = description.trim();
            if (description) {
                descriptions.push(description);
            }
        }
        if (descriptions.length > 0) {
            return descriptions.join(". ") + ".";
        } else {
            return "";
        }
    }
    return [
        describeEntityGroup(aliveEntities, "default"),
        describeEntityGroup(deadEntities, "destroyed"),
    ]
        .filter((s) => s)
        .join("\n");
}

function getAdditionalInfo(
    player: Player,
    entities: Actor[],
    entityType: EntityType,
): string {
    const sample = entities[0];
    if (!sample) {
        return "";
    }
    // Monster
    if (entityType === "monster") {
        const [hostile, aggro] = isHostile(player, sample as Monster);
        if (hostile && isEntityAlive(sample)) {
            return " looking threateningly at you";
        }
    }
    // Item
    else if (entityType === "item") {
        const prop = (sample as Item).prop;
        if (compendium[prop].weight < 0 && isEntityAlive(sample)) {
            return " firmly fixed in place";
        }
    }
    return "";
}

function applyEntityDescriptors(
    entities: Actor[],
    rules: EntityDescriptors,
    entityState: EntityDescriptionState,
): string {
    const count = entities.length;
    if (count <= 0) {
        return "";
    }

    // Get descriptor
    let description =
        rules.descriptors[rules.descriptors.length - 1][1][entityState];
    for (const [threshold, template] of rules.descriptors) {
        if (count <= threshold) {
            description = template[entityState];
            break;
        }
    }

    // Replace count
    description = description.replace(/{count}/g, count.toString());

    // Replace {name}
    let it = 0;
    for (const _ of description.matchAll(/{name}/g)) {
        description = description.replace(
            /{name}/, // replace the first match
            nameEntityLink(entities[it]),
        );
        it += 1;
    }

    // Replace {names} (use the remaining entities)
    if (entities.length > 1) {
        description = description.replace(
            /{names}/g,
            entities
                .slice(it)
                .map((e) => nameEntityLink(e))
                .join(", "),
        );
    }

    return description;
}

function nameEntityLink(entity: Actor): string {
    const [entityId, entityType] = getEntityId(entity);
    return `{${entity.name}}[${entityType}:${entityId}]`;
}

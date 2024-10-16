import { groupBy, partition } from "lodash-es";
import type { Actor, EntityType, Item, Monster } from "../types";
import { getEntityId, isEntityAlive } from "../utils";
import { bestiary } from "../world/settings/bestiary";
import { compendium } from "../world/settings/compendium";
import type { EntityDescriptionState, EntityDescriptors } from "./settings";

export { descibeEntities };

function descibeEntities(
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
            description += getAdditionalInfo(group, entityType);
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

function getAdditionalInfo(entities: Actor[], entityType: EntityType): string {
    const sample = entities[0];
    if (!sample) {
        return "";
    }

    // Monster
    if (entityType === "monster") {
        const monster = bestiary[(sample as Monster).beast];
        if (monster.alignment === "evil" && isEntityAlive(sample)) {
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
        console.log(description);
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

import { groupBy, partition } from "lodash-es";
import type { EntityType, GameEntity, Item, Monster, Player } from "../types";
import { bestiary } from "../world/settings/bestiary";
import { compendium } from "../world/settings/compendium";
import type { EntityDescriptionState, EntityDescriptors } from "./settings";

export { descibeEntities };

function descibeEntities(
    entities: GameEntity[],
    entityType: EntityType,
    entityDescriptors: Record<EntityType, EntityDescriptors>,
): string {
    console.log(JSON.stringify(entities, null, 2));
    // Seperate entities which are dead or destroyed
    const [aliveEntities, deadEntities] = partition(entities, (e) => {
        if (entityType === "item") return (e as Item).dur > 0;
        if (entityType === "monster" || entityType === "player")
            return (e as Monster | Player).hp > 0;
        return true;
    });

    function describeEntityGroup(
        entities: GameEntity[],
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

function getAdditionalInfo(
    entities: GameEntity[],
    entityType: EntityType,
): string {
    const sample = entities[0];
    if (!sample) {
        return "";
    }

    // Monster
    if (entityType === "monster") {
        const monster = bestiary[(sample as Monster).beast];
        if (monster.alignment === "evil" && (sample as Monster).hp > 0) {
            return " looking threateningly at you";
        }
    }
    // Item
    else if (entityType === "item") {
        const prop = (sample as Item).prop;
        if (compendium[prop].weight < 0 && (sample as Item).dur > 0) {
            return " firmly fixed in place";
        }
    }
    return "";
}

function applyEntityDescriptors(
    entities: GameEntity[],
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

    // Replace placeholders
    description = description
        .replace(/{name}/g, entities[0].name)
        .replace(
            /{names}/g,
            entities
                .slice(0, -1)
                .map((e) => e.name)
                .join(", "),
        )
        .replace(/{count}/g, count.toString());

    return description;
}

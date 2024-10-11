import type {
    Creature,
    EntityType,
    Item,
    Monster,
    Player,
} from "$lib/crossover/types";
import type { GameActionEntities, TokenPositions } from "../ir";
import { getEntityId, isEntityAlive } from "../utils";
import { actions } from "./settings/actions";
import { compendium } from "./settings/compendium";
import type { SkillLines } from "./skills";
import {
    equipmentSlots,
    geohashLocationTypes,
    type BarterSerialized,
    type EquipmentSlot,
} from "./types";

export {
    resolveActionEntities,
    type Action,
    type Actions,
    type IconAssetMetadata,
};

type Actions =
    | "look"
    | "attack"
    | "say"
    | "move"
    | "equip"
    | "unequip"
    | "take"
    | "drop"
    | "create"
    | "configure"
    | "inventory"
    | "enter" // targets a item's world property
    | "learn"
    | "trade"
    | "writ"
    | "browse"
    | "accept"
    | "fulfill"
    | "give"
    | "rest";

type TokenType = "action" | "target" | "skill" | "offer" | "receive" | "item";

type TokenContext = {
    position: number;
    optional: boolean;
    entityTypes?: EntityType[];
};

interface Action {
    action: Actions;
    synonyms?: string[];
    description: string;
    predicate: {
        tokens: Partial<Record<TokenType, TokenContext>>;
    };
    range: number;
    ticks: number;
    icon: IconAssetMetadata;
}

interface IconAssetMetadata {
    path: string; // eg. bundle/alias
    icon: string;
}

function parseBarter(barterString: string): BarterSerialized | undefined {
    let umb = 0;
    let lum = 0;
    let items = [];
    let props = [];
    let ok = false;
    for (const s of barterString.split(",")) {
        if (s.endsWith("lum")) {
            lum = parseInt(s); // will parse the numbers only
            ok = true;
        } else if (s.endsWith("umb")) {
            umb = parseInt(s); // will parse the numbers only
            ok = true;
        } else if (s.startsWith("item")) {
            items.push(s);
            ok = true;
        } else if (compendium[s]) {
            ok = true;
            props.push(s);
        }
    }
    if (!ok) {
        return undefined;
    } else {
        return {
            items,
            props,
            currency: {
                lum,
                umb,
            },
        };
    }
}

function filterTargetCreaturesByAction(
    action: Actions,
    self: Creature,
    creatures: Creature[],
) {
    // Can only attack non destroyed objects
    if (action === actions.attack.action) {
        return creatures.filter(isEntityAlive);
    }
    // Can only browse players
    else if (action === actions.browse.action) {
        return creatures.filter((creature) => (creature as Player).player);
    }

    return creatures;
}

function filterTargetItemsByAction(
    action: Actions,
    self: Creature,
    items: Item[],
) {
    // Can only equip/give an item in inventory
    if (action === actions.equip.action || action === actions.give.action) {
        return items.filter(
            (item) =>
                item.locT === "inv" && item.loc[0] === getEntityId(self)[0],
        );
    }
    // Can only unequip an item already equipped
    else if (action === actions.unequip.action) {
        return items.filter(
            (item) =>
                equipmentSlots.has(item.locT as EquipmentSlot) &&
                item.loc[0] === getEntityId(self)[0],
        );
    }
    // Can only take an item from environment
    else if (action === actions.take.action) {
        return items.filter((item) => geohashLocationTypes.has(item.locT));
    }
    // Can only drop an item from inventory/equipped
    else if (action === actions.drop.action) {
        return items.filter(
            (item) =>
                item.locT === "inv" ||
                equipmentSlots.has(item.locT as EquipmentSlot),
        );
    }
    // Can only enter an item with a world
    else if (action === actions.enter.action) {
        return items.filter((item) => compendium[item.prop].world != null);
    }
    // Can only fulfill a writ
    else if (action === actions.fulfill.action) {
        return items.filter((item) => item.prop === compendium.tradewrit.prop);
    }
    // Can only attack non destroyed objects
    else if (action === actions.attack.action) {
        return items.filter(isEntityAlive);
    }

    return items;
}

function resolveActionEntities({
    queryTokens,
    tokenPositions,
    action,
    self,
    monsters,
    players,
    items,
    skills,
}: {
    queryTokens: string[];
    tokenPositions: TokenPositions;
    action: Action;
    self: Creature;
    monsters: Monster[];
    players: Player[];
    items: Item[];
    skills: SkillLines[];
}): GameActionEntities[] {
    let gameActionEntitiesScores: [GameActionEntities, number][] = [];

    /**
     * Extract all contexts for predicate
     */
    let offer: BarterSerialized | undefined = undefined;
    let receive: BarterSerialized | undefined = undefined;
    let skill: SkillLines | undefined = undefined;
    let item: Item | undefined = undefined;

    for (const [context, { position, optional, entityTypes }] of Object.entries(
        actions[action.action].predicate.tokens,
    ) as [TokenType, TokenContext][]) {
        const token = queryTokens[position];
        // Missing required action token
        if (context === "action") {
            if (
                !optional &&
                !(
                    action.action in tokenPositions &&
                    position in tokenPositions[action.action]
                )
            )
                return [];
        }
        // Missing valid barter items
        else if (context === "offer") {
            offer = parseBarter(token); // extract from raw token
            if (!optional && !offer) return [];
        } else if (context === "receive") {
            receive = parseBarter(token);
            if (!optional && !receive) return [];
        }
        // Missing valid skill
        else if (context === "skill") {
            // TODO: Add test to check if fuzzy search works
            skill = skills.find((s) => tokenPositions[s]);
            if (!optional && !skill) return [];
        } else if (context === "item") {
            for (const [entityId, matchedTokenPositions] of Object.entries(
                tokenPositions,
            )) {
                if (
                    matchedTokenPositions[position]?.token ===
                    queryTokens[position]
                ) {
                    item = items.find((i) => i.item === entityId);
                    break;
                }
            }
            if (!optional && !item) return [];
        } else if (context === "target") {
            if (entityTypes) {
                for (const entityType of entityTypes) {
                    const gameEntities =
                        entityType === "monster"
                            ? filterTargetCreaturesByAction(
                                  action.action,
                                  self,
                                  monsters,
                              )
                            : entityType === "player"
                              ? filterTargetCreaturesByAction(
                                    action.action,
                                    self,
                                    players,
                                )
                              : filterTargetItemsByAction(
                                    action.action,
                                    self,
                                    items,
                                );

                    // Find all possible targets in gameEntities
                    for (const target of gameEntities ?? []) {
                        const entityId = getEntityId(target)[0];
                        if (position in tokenPositions[entityId]) {
                            gameActionEntitiesScores.push([
                                {
                                    self,
                                    target,
                                    skill,
                                    offer,
                                    receive,
                                    item,
                                },
                                tokenPositions[entityId][position].score,
                            ]);
                        }
                    }
                }
            }
            if (!optional && gameActionEntitiesScores.length === 0) return [];
        }
    }

    // If no target is allowed
    if (gameActionEntitiesScores.length === 0) {
        return [{ self, skill, receive, offer, item }];
    }

    // Sort by score
    return gameActionEntitiesScores
        .sort((a, b) => b[1] - a[1])
        .map((a) => a[0]);
}

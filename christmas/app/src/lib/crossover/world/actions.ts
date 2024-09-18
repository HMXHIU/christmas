import type { EntityType, Item, Monster, Player } from "$lib/crossover/types";
import type { GameActionEntities, TokenPositions } from "../ir";
import { getEntityId } from "../utils";
import { actions } from "./settings/actions";
import { compendium } from "./settings/compendium";
import type { SkillLines } from "./skills";
import {
    EquipmentSlots,
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

type ActionTargets = EntityType | "none";

type SpecialTokens =
    | "action"
    | "target"
    | "skill"
    | "offer"
    | "receive"
    | "item";

interface Action {
    action: Actions;
    synonyms?: string[];
    description: string;
    predicate: {
        target: ActionTargets[];
        tokenPositions: Partial<Record<SpecialTokens, number>>;
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
    self: Player | Monster;
    monsters: Monster[];
    players: Player[];
    items: Item[];
    skills: SkillLines[];
}): GameActionEntities[] {
    const { target: targetTypes, tokenPositions: predicateTokenPositions } =
        actions[action.action].predicate;
    const {
        action: actionTokenPosition,
        target: targetTokenPosition,
        skill: skillTokenPosition,
        receive: receiveTokenPosition,
        offer: offerTokenPosition,
        item: itemTokenPosition,
    } = predicateTokenPositions;

    // Check action token position
    if (
        actionTokenPosition != null &&
        !(
            action.action in tokenPositions &&
            actionTokenPosition in tokenPositions[action.action]
        )
    ) {
        return [];
    }

    let gameActionEntitiesScores: [GameActionEntities, number][] = [];

    // Check offer & receive token position
    let receive: BarterSerialized | undefined = undefined;
    let offer: BarterSerialized | undefined = undefined;
    if (receiveTokenPosition != null) {
        receive = parseBarter(queryTokens[receiveTokenPosition]);
        if (!receive) {
            return [];
        }
    }
    if (offerTokenPosition != null) {
        offer = parseBarter(queryTokens[offerTokenPosition]);
        if (!offer) {
            return [];
        }
    }

    // Check skill token position
    const skill = skills.find((s) => tokenPositions[s]);
    if (skillTokenPosition != null && skill == null) {
        return [];
    }

    // Check item token position
    let item: Item | undefined = undefined;
    if (itemTokenPosition != null) {
        for (const [entityId, matchedTokenPositions] of Object.entries(
            tokenPositions,
        )) {
            if (
                matchedTokenPositions[itemTokenPosition]?.token ===
                queryTokens[itemTokenPosition]
            ) {
                item = items.find((i) => i.item === entityId);
                break;
            }
        }
        if (!item) {
            return [];
        }
    }

    // Find target type in monsters, players, and items
    for (const targetType of targetTypes) {
        let targetList: (Player | Monster | Item)[] = [];

        // Filter target list based on target type
        if (targetType === "monster") {
            targetList = monsters;
        } else if (targetType === "player") {
            targetList = players;
        } else if (targetType === "item") {
            targetList = items;
            // Can only equip/give an item in inventory
            if (
                action.action === actions.equip.action ||
                action.action === actions.give.action
            ) {
                targetList = targetList.filter(
                    (item) =>
                        item.locT === "inv" &&
                        item.loc[0] === getEntityId(self)[0],
                );
            }
            // Can only unequip an item already equipped
            else if (action.action === actions.unequip.action) {
                targetList = targetList.filter(
                    (item) =>
                        EquipmentSlots.includes(item.locT as EquipmentSlot) &&
                        item.loc[0] === getEntityId(self)[0],
                );
            }
            // Can only take an item from environment
            else if (action.action === actions.take.action) {
                targetList = targetList.filter((item) =>
                    geohashLocationTypes.has(item.locT),
                );
            }
            // Can only drop an item from inventory/equipped
            else if (action.action === actions.drop.action) {
                targetList = targetList.filter(
                    (item) =>
                        item.locT === "inv" ||
                        EquipmentSlots.includes(item.locT as EquipmentSlot),
                );
            }
            // Can only enter an item with a world
            else if (action.action === actions.enter.action) {
                targetList = (targetList as Item[]).filter(
                    (item) => compendium[item.prop].world != null,
                );
            }
        } else {
            continue;
        }

        // Find target entities
        for (const target of targetList) {
            const [entityId, entityType] = getEntityId(target);
            // Check target token position
            if (
                targetTokenPosition &&
                targetTokenPosition in tokenPositions[entityId]
            ) {
                gameActionEntitiesScores.push([
                    {
                        self,
                        target,
                        skill,
                        offer,
                        receive,
                        item,
                    },
                    tokenPositions[entityId][targetTokenPosition].score,
                ]);
            }
        }
    }

    // If no target is allowed
    if (gameActionEntitiesScores.length === 0 && targetTypes.includes("none")) {
        return [{ self, skill, receive, offer, item }];
    }

    // Sort by score
    return gameActionEntitiesScores
        .sort((a, b) => b[1] - a[1])
        .map((a) => a[0]);
}

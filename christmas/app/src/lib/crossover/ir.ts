import type {
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import { resolveActionEntities, type Action } from "./actions";
import { entityId, gameActionId } from "./utils";
import { resolveAbilityEntities, type Ability } from "./world/abilities";
import type { Utility } from "./world/compendium";
import { compendium } from "./world/settings";

export {
    entitiesIR,
    fuzzyMatch,
    gameActionsIR,
    searchPossibleCommands,
    tokenize,
    type GameAction,
    type GameActionEntities,
    type GameCommand,
    type GameCommandVariables,
    type TokenPositions,
};

type MatchedTokenPosition = Record<number, { token: string; score: number }>;
type TokenPositions = Record<string, MatchedTokenPosition>;
type GameCommandVariables = {
    query: string;
    queryIrrelevant: string; // stripped of relevant tokens (eg. entities, actions, abilities, utility)
};
type GameActionEntities = {
    self: Player | Monster;
    target?: Player | Monster | Item;
    item?: Item;
};
type GameAction = Ability | Utility | Action;
type GameCommand = [GameAction, GameActionEntities, GameCommandVariables?];

/**
 * Retrieves abilities and utilities based on the given query tokens.
 * @param queryTokens - The query tokens used to filter the abilities and utilities.
 * @param abilities - The list of abilities to filter.
 * @param itemUtilities - The list of [item, utilities] to filter.
 * @returns An object containing the filtered abilities and itemUtilities.
 */
function gameActionsIR({
    queryTokens,
    abilities,
    itemUtilities,
    actions,
}: {
    queryTokens: string[];
    abilities: Ability[];
    itemUtilities: [Item, Utility][];
    actions: Action[];
}): {
    abilities: Ability[];
    itemUtilities: [Item, Utility][];
    actions: Action[];
    tokenPositions: TokenPositions;
} {
    let tokenPositions: TokenPositions = {};

    abilities = abilities.filter((ability) => {
        return [ability.ability].some((document) => {
            const { score, matchedTokens } = documentScore(
                queryTokens,
                document,
            );
            if (score > 0.6) {
                tokenPositions[ability.ability] = matchedTokens;
                return true;
            }
            return false;
        });
    });

    itemUtilities = itemUtilities.filter(([item, utility]) => {
        return [utility.utility].some((document) => {
            const { score, matchedTokens } = documentScore(
                queryTokens,
                document,
            );
            if (score > 0.6) {
                tokenPositions[utility.utility] = matchedTokens;
                return true;
            }
            return false;
        });
    });

    actions = actions.filter((action) => {
        return [action.action].some((document) => {
            const { score, matchedTokens } = documentScore(
                queryTokens,
                document,
            );
            if (score > 0.6) {
                tokenPositions[action.action] = matchedTokens;
                return true;
            }
            return false;
        });
    });

    return {
        abilities: abilities || [],
        itemUtilities: itemUtilities || [],
        actions: actions || [],
        tokenPositions,
    };
}

/**
 * Retrieves entities based on the given query tokens.
 * @param queryTokens - The tokens representing the query.
 * @param entities - The entities to search within.
 * @returns An object containing the filtered monsters, players, and items.
 */
function entitiesIR({
    queryTokens,
    monsters,
    players,
    items,
}: {
    queryTokens: string[];
    monsters: Monster[];
    players: Player[];
    items: Item[];
}): {
    monsters: Monster[];
    players: Player[];
    items: Item[];
    tokenPositions: TokenPositions;
} {
    let tokenPositions: TokenPositions = {};

    monsters = monsters.filter((monster) => {
        return [monster.beast, monster.name, monster.monster].some(
            (document) => {
                const { score, matchedTokens } = documentScore(
                    queryTokens,
                    document,
                );
                if (score > 0.6) {
                    tokenPositions[monster.monster] = matchedTokens;
                    return true;
                }
                return false;
            },
        );
    });

    players = players.filter((player) => {
        return [player.name, player.player].some((document) => {
            const { score, matchedTokens } = documentScore(
                queryTokens,
                document,
            );
            if (score > 0.6) {
                tokenPositions[player.player] = matchedTokens;
                return true;
            }
            return false;
        });
    });

    items = items.filter((item) => {
        return [item.name, item.item].some((document) => {
            const { score, matchedTokens } = documentScore(
                queryTokens,
                document,
            );
            if (score > 0.6) {
                tokenPositions[item.item] = matchedTokens;
                return true;
            }
            return false;
        });
    });

    return {
        monsters: monsters || [],
        players: players || [],
        items: items || [],
        tokenPositions,
    };
}

function maxLevenshteinDistance(query: string): number {
    if (query.length <= 3) {
        return 0;
    } else if (query.length <= 4) {
        return 1;
    } else if (query.length <= 7) {
        return 2;
    }
    return 3;
}

function tokenize(query: string): string[] {
    return query.split(/\s+/).map((token) => token.toLowerCase());
}

function tokenMatchAny(token: string, matchAny: string[]): number {
    // Fast path for exact matches
    if (matchAny.includes(token)) {
        return 1;
    }
    // Try to find a fuzzy match
    for (let document of matchAny) {
        if (
            fuzzyMatch(
                token.toLowerCase(),
                document.toLowerCase(),
                maxLevenshteinDistance(document),
            )
        ) {
            return 0.8;
        }
    }
    return 0;
}

/**
 * Calculates the score of a document based on the matching tokens with a query.
 * Also returns the matched tokens and their positions in `queryTokens`.
 *
 * @param queryTokens - An array of query tokens.
 * @param document - The document to calculate the score for.
 * @returns An object containing the matched tokens and the score.
 */
function documentScore(
    queryTokens: string[],
    document: string,
): {
    matchedTokens: MatchedTokenPosition;
    score: number;
} {
    const documentTokens = tokenize(document);
    const denominator = documentTokens.length;
    let matchedTokens: MatchedTokenPosition = {};

    if (denominator === 0) {
        return {
            matchedTokens,
            score: 0,
        };
    }
    let numerator = 0;
    for (let i = 0; i < queryTokens.length; i++) {
        const token = queryTokens[i];
        const tokenScore = tokenMatchAny(token, documentTokens);
        if (tokenScore > 0.5) {
            matchedTokens[i] = {
                token,
                score: tokenScore,
            };
        }
        numerator += tokenScore;
        if (numerator >= denominator) {
            return {
                matchedTokens,
                score: 1,
            };
        }
    }
    return {
        matchedTokens,
        score: numerator / denominator,
    };
}

/**
 * Performs fuzzy string matching using the Levenshtein distance algorithm with optimizations.
 *
 * @param str1 - The first string to compare.
 * @param str2 - The second string to compare.
 * @param maxErrors - The maximum number of errors allowed for a match.
 * @returns True if the strings match within the specified error threshold, false otherwise.
 */
function fuzzyMatch(str1: string, str2: string, maxErrors: number): boolean {
    const m = str1.length;
    const n = str2.length;

    // Base cases
    if (m === 0) return n <= maxErrors; // If either of the strings is empty, it checks if the length of the non-empty string is less than or equal to maxErrors.
    if (n === 0) return m <= maxErrors;
    if (Math.abs(m - n) > maxErrors) return false; // difference between the lengths of str1 and str2 is greater than maxErrors

    // Create a 2D array to store the Levenshtein distances
    const dp = Array.from({ length: m + 1 }, () =>
        Array.from({ length: n + 1 }, () => 0),
    );

    // Initialize the first row and column (These values represent the distances from an empty string to each character in str1 and str2)
    for (let i = 0; i <= m; i++) {
        dp[i][0] = i; // first row with values from 0 to m
    }
    for (let j = 0; j <= n; j++) {
        dp[0][j] = j; // first column with values from 0 to n.
    }

    // Fill the rest of the table
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            // If the characters at positions i-1 in str1 and j-1 in str2 are the same,
            // it assigns the value from the top-left diagonal cell (dp[i - 1][j - 1]) to the current cell.
            // This operation represents no change (i.e., a match).
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            }
            // Characters is different
            else {
                dp[i][j] =
                    1 +
                    Math.min(
                        dp[i - 1][j], // Insertion: The value in the cell above (dp[i - 1][j]) plus 1.
                        dp[i][j - 1], // Deletion: The value in the cell to the left (dp[i][j - 1]) plus 1.
                        dp[i - 1][j - 1], // Substitution: The value in the top-left diagonal cell (dp[i - 1][j - 1]) plus 1.
                    );
            }

            // Pruning
            if (dp[i][j] > maxErrors) {
                // Early termination considering remaining characters
                // even if we match the remaining characters perfectly,
                // the total Levenshtein distance will still be greater than the allowed error threshold.
                const remainingLength = m - i + n - j;
                if (dp[i][j] > maxErrors + remainingLength) {
                    return false;
                }
            }
        }
    }

    // Check if the final Levenshtein distance is within the allowed error threshold
    return dp[m][n] <= maxErrors;
}

function searchPossibleCommands({
    query,
    // Player
    player,
    playerAbilities,
    playerItems,
    // Environment
    monsters,
    players,
    items,
    // Actions
    actions,
}: {
    query: string;
    player: Player;
    playerItems: Item[];
    playerAbilities: Ability[];
    monsters: Monster[];
    players: Player[];
    items: Item[];
    actions: Action[];
}): {
    commands: GameCommand[];
    queryTokens: string[];
    tokenPositions: TokenPositions;
} {
    const queryTokens = tokenize(query);

    // Entities in environment relevant to the query
    var {
        monsters: monstersRetrieved,
        players: playersRetrieved,
        items: itemsRetrieved,
        tokenPositions: entityTokenPositions,
    } = entitiesIR({
        queryTokens,
        monsters,
        players,
        items: [...playerItems, ...items], // include player items in the search
    });

    // All possible utilities from playerItems
    const playerItemUtilities = playerItems.flatMap((item) => {
        return Object.values(compendium[item.prop].utilities).map(
            (utility): [Item, Utility] => {
                return [item, utility];
            },
        );
    });

    // All possible utilities from environment
    const environmentItemUtilities = items.flatMap((item) => {
        return Object.values(compendium[item.prop].utilities).map(
            (utility): [Item, Utility] => {
                return [item, utility];
            },
        );
    });

    // Player abilities & utilities relevant to the query
    var {
        itemUtilities: itemUtilitiesPossible,
        abilities: abilitiesPosssible,
        actions: actionsPossible,
        tokenPositions: gameActionsTokenPositions,
    } = gameActionsIR({
        queryTokens,
        abilities: playerAbilities,
        itemUtilities: [...playerItemUtilities, ...environmentItemUtilities],
        actions,
    });

    const allTokenPositions = {
        ...entityTokenPositions,
        ...gameActionsTokenPositions,
    };

    const abilityCommands = abilitiesPosssible
        .map((ability) => {
            const entities = resolveAbilityEntities({
                queryTokens,
                tokenPositions: allTokenPositions,
                ability: ability.ability,
                self: player,
                monsters: monstersRetrieved,
                players: playersRetrieved,
                items: itemsRetrieved,
            });
            return entities ? [ability, entities] : null;
        })
        .filter((x) => x != null) as GameCommand[];

    const utilityCommands = itemUtilitiesPossible
        .map(([item, utility]) => {
            let entities = null;
            // Check if the utility performs an ability
            if (utility.ability) {
                entities = resolveAbilityEntities({
                    queryTokens,
                    tokenPositions: allTokenPositions,
                    ability: utility.ability,
                    self: player, // Note: self is still the player when performing an ability from an item
                    monsters: monstersRetrieved,
                    players: playersRetrieved,
                    items: itemsRetrieved,
                });
            }
            // Utilities that dont have an ability (eg. open door)
            else {
                // Note: there is no target for such item utilities, use ability if target is needed
                entities = { self: player };
            }

            // Insert the item being used into the entities
            return entities ? [utility, { ...entities, item: item }] : null;
        })
        .filter((x) => x != null) as GameCommand[];

    const actionCommands = actionsPossible
        .map((action) => {
            const entities = resolveActionEntities({
                queryTokens,
                tokenPositions: allTokenPositions,
                action,
                self: player,
                monsters: monstersRetrieved,
                players: playersRetrieved,
                items: itemsRetrieved,
            });
            if (entities != null) {
                const variables = commandVariables({
                    gameAction: action,
                    gameEntities: entities,
                    queryTokens,
                    tokenPositions: allTokenPositions,
                });
                return [action, entities, variables];
            } else {
                return null;
            }
        })
        .filter((x) => x != null) as GameCommand[];

    return {
        commands: [...abilityCommands, ...utilityCommands, ...actionCommands],
        queryTokens,
        tokenPositions: allTokenPositions,
    };
}

function commandVariables({
    gameAction,
    gameEntities,
    queryTokens,
    tokenPositions,
}: {
    gameAction: GameAction;
    gameEntities: GameActionEntities;
    queryTokens: string[];
    tokenPositions: TokenPositions;
}): GameCommandVariables {
    const { self, target, item } = gameEntities;

    const actionId = gameActionId(gameAction);
    const selfId = entityId(self)[0];
    const targetId = target != null ? entityId(target)[0] : null;
    const itemId = item != null ? entityId(item)[0] : null;

    const relevantPositions = [
        ...Object.keys(tokenPositions[actionId] || {}),
        ...Object.keys(tokenPositions[selfId] || {}),
        ...(targetId ? Object.keys(tokenPositions[targetId] || {}) : []),
        ...(itemId ? Object.keys(tokenPositions[itemId] || {}) : []),
    ];

    const queryIrrelevant = Array.from(queryTokens.entries())
        .filter(([pos, token]) => {
            return !relevantPositions.includes(String(pos));
        })
        .map(([pos, token]) => token)
        .join(" ")
        .trim();

    return {
        query: queryTokens.join(" "),
        queryIrrelevant,
    };
}

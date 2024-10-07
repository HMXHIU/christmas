import type {
    Actor,
    Creature,
    Item,
    Monster,
    Player,
} from "$lib/crossover/types";
import { filterSortEntitiesInRange, gameActionId, getEntityId } from "./utils";
import { resolveAbilityEntities, type Ability } from "./world/abilities";
import { resolveActionEntities, type Action } from "./world/actions";
import type { Utility } from "./world/compendium";
import { compendium } from "./world/settings/compendium";
import { skillLines } from "./world/settings/skills";
import { type SkillLines } from "./world/skills";
import type { BarterSerialized } from "./world/types";

export {
    COMMAND_SEARCH_RANGE,
    documentScore,
    documentsScore,
    entitiesIR,
    fuzzyMatch,
    gameActionsIR,
    getGameActionId,
    searchPossibleCommands,
    tokenize,
    type GameAction,
    type GameActionEntities,
    type GameActionType,
    type GameCommand,
    type GameCommandVariables,
    type MatchedTokenPosition,
    type TokenPositions,
};

const COMMAND_SEARCH_RANGE = 5;

type MatchedTokenPosition = Record<number, { token: string; score: number }>;
type TokenPositions = Record<string, MatchedTokenPosition>;
type GameCommandVariables = {
    query: string;
    queryIrrelevant: string; // stripped of relevant tokens (eg. entities, actions, abilities, utility)
};
type GameActionEntities = {
    self: Creature;
    target?: Actor;
    item?: Item;
    skill?: SkillLines;
    offer?: BarterSerialized;
    receive?: BarterSerialized;
};
type GameActionType = "ability" | "utility" | "action";
type GameAction = Ability | Utility | Action;
type GameCommand = [GameAction, GameActionEntities, GameCommandVariables?];

function getGameActionId(gameAction: GameAction): [string, GameActionType] {
    if ("utility" in gameAction) {
        return [gameAction.utility, "utility"];
    } else if ("ability" in gameAction) {
        return [gameAction.ability, "ability"];
    } else {
        return [gameAction.action, "action"];
    }
}

/**
 * Retrieves abilities and utilities based on the given query tokens.
 * @param queryTokens - The query tokens used to filter the abilities and utilities.
 * @param abilities - The list of abilities to filter.
 * @param itemUtilities - The list of [item, utilities] to filter.
 * @param actions - The list of actions to filter.
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
        return [action.action, ...(action.synonyms ?? [])].some((document) => {
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
    skills,
}: {
    queryTokens: string[];
    monsters: Monster[];
    players: Player[];
    items: Item[];
    skills: SkillLines[];
}): {
    monsters: Monster[];
    players: Player[];
    items: Item[];
    skills: SkillLines[];
    tokenPositions: TokenPositions;
} {
    const tokenPositions: TokenPositions = {};

    const filterEntities = (
        entities: any[],
        getDocuments: (entity: any) => string[],
    ) =>
        entities.filter((entity) => {
            let highestScore = 0;
            let highestMatchedTokens: MatchedTokenPosition | null = null;

            getDocuments(entity).forEach((document) => {
                const { score, matchedTokens } = documentScore(
                    queryTokens,
                    document,
                );
                if (score > highestScore) {
                    highestScore = score;
                    highestMatchedTokens = matchedTokens;
                }
            });

            if (highestScore > 0.6 && highestMatchedTokens != null) {
                tokenPositions[
                    entity.monster || entity.player || entity.item || entity
                ] = highestMatchedTokens;
                return true;
            }
            return false;
        });

    return {
        monsters: filterEntities(monsters, (monster) => [
            monster.beast,
            monster.name,
            monster.monster,
            monster.monster.slice("monster_".length),
        ]),
        players: filterEntities(players, (player) => [
            player.name,
            player.player,
        ]),
        items: filterEntities(items, (item) => [
            item.prop,
            item.name,
            item.item,
            item.item.slice("item_".length),
        ]),
        skills: filterEntities(skills, (skill) => [
            skill,
            skillLines[skill as SkillLines].name,
        ]),
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
        const { normalizedScore, isMatch } = fuzzyMatch(
            token.toLowerCase(),
            document.toLowerCase(),
            maxLevenshteinDistance(document),
        );
        if (isMatch) {
            return normalizedScore;
        }
    }
    return 0;
}

function documentsScore(
    queryTokens: string[],
    documents: string[],
): {
    matchedTokens: MatchedTokenPosition;
    score: number;
} {
    let highestScoreResult = {
        matchedTokens: {} as MatchedTokenPosition,
        score: 0,
    };

    for (const document of documents) {
        const result = documentScore(queryTokens, document);
        if (result.score > highestScoreResult.score) {
            highestScoreResult = result;
        }
    }

    return highestScoreResult;
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
 * @returns An object containing a boolean indicating if the strings match within the specified error threshold,
 *          the Levenshtein distance score, and the normalized score.
 */
function fuzzyMatch(
    str1: string,
    str2: string,
    maxErrors: number,
): { isMatch: boolean; score: number; normalizedScore: number } {
    const m = str1.length;
    const n = str2.length;

    // Base cases
    if (m === 0)
        return {
            isMatch: n <= maxErrors,
            score: n,
            normalizedScore: n === 0 ? 1 : 0,
        }; // If either of the strings is empty, it checks if the length of the non-empty string is less than or equal to maxErrors.
    if (n === 0)
        return {
            isMatch: m <= maxErrors,
            score: m,
            normalizedScore: m === 0 ? 1 : 0,
        };
    if (Math.abs(m - n) > maxErrors)
        return { isMatch: false, score: Math.abs(m - n), normalizedScore: 0 }; // difference between the lengths of str1 and str2 is greater than maxErrors

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
                    return {
                        isMatch: false,
                        score: dp[i][j],
                        normalizedScore: 0,
                    };
                }
            }
        }
    }

    // Calculate the final Levenshtein distance
    const finalScore = dp[m][n];

    // Calculate the maximum possible distance (length of the longer string)
    const maxLength = Math.max(m, n);

    // Normalize the score
    const normalizedScore = 1 - finalScore / maxLength;

    // Check if the final Levenshtein distance is within the allowed error threshold
    return {
        isMatch: finalScore <= maxErrors,
        score: finalScore,
        normalizedScore,
    };
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
    // Skills
    skills,
}: {
    query: string;
    player: Player;
    playerItems: Item[];
    playerAbilities: Ability[];
    monsters: Monster[];
    players: Player[];
    items: Item[];
    actions: Action[];
    skills: SkillLines[];
}): {
    commands: GameCommand[];
    queryTokens: string[];
    tokenPositions: TokenPositions;
} {
    const queryTokens = tokenize(query);

    // Filter entities in range
    monsters = filterSortEntitiesInRange(
        player,
        monsters,
        COMMAND_SEARCH_RANGE,
    ) as Monster[];
    players = filterSortEntitiesInRange(
        player,
        players,
        COMMAND_SEARCH_RANGE,
    ) as Player[];
    items = filterSortEntitiesInRange(
        player,
        items,
        COMMAND_SEARCH_RANGE,
    ) as Item[];

    // Writ items can be interacted with even in another player's inventory (get via `browse`)
    const writs = items.filter((i) => i.prop === compendium.tradewrit.prop);
    items.push(...writs);

    // Entities in environment relevant to the query
    var {
        monsters: monstersRetrieved,
        players: playersRetrieved,
        items: itemsRetrieved,
        skills: skillsRetrieved,
        tokenPositions: entityTokenPositions,
    } = entitiesIR({
        queryTokens,
        monsters,
        players: [...players, player],
        items: [...playerItems, ...items], // include player items in the search
        skills,
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

    const abilityCommands: GameCommand[] = abilitiesPosssible.flatMap(
        (ability) => {
            return resolveAbilityEntities({
                queryTokens,
                tokenPositions: allTokenPositions,
                ability: ability.ability,
                self: player,
                monsters: monstersRetrieved,
                players: playersRetrieved,
                items: itemsRetrieved,
            }).map((entities) => {
                return [ability, entities] as GameCommand;
            });
        },
    );

    const actionCommands: GameCommand[] = actionsPossible
        .flatMap((action) => {
            return resolveActionEntities({
                queryTokens,
                tokenPositions: allTokenPositions,
                action,
                self: player,
                monsters: monstersRetrieved,
                players: playersRetrieved,
                items: itemsRetrieved,
                skills: skillsRetrieved,
            }).map((entities) => {
                return { action, entities };
            });
        })
        .map(({ action, entities }) => {
            const variables = commandVariables({
                action,
                gameEntities: entities,
                queryTokens,
                tokenPositions: allTokenPositions,
            });
            return [action, entities, variables];
        });

    const utilityCommands: GameCommand[] = itemUtilitiesPossible.flatMap(
        ([item, utility]) => {
            // Check if the utility performs an ability
            if (utility.ability) {
                return resolveAbilityEntities({
                    queryTokens,
                    tokenPositions: allTokenPositions,
                    ability: utility.ability,
                    self: player, // Note: self is still the player when performing an ability from an item
                    monsters: monstersRetrieved,
                    players: playersRetrieved,
                    items: itemsRetrieved,
                }).map((entities) => {
                    return [utility, { ...entities, item }] as GameCommand; // Insert the item being used into the entities
                });
            }
            // Utilities that dont have an ability (eg. open door)
            else {
                // Note: there is no target for such item utilities, use ability if target is needed
                return [[utility, { self: player, item }]];
            }
        },
    );

    // Sort commands by relevance
    let commands = [...abilityCommands, ...utilityCommands, ...actionCommands]
        .map(
            (c) =>
                [gameCommandScore(c, allTokenPositions, queryTokens), c] as [
                    number,
                    GameCommand,
                ],
        )
        .sort((a, b) => b[0] - a[0]);

    // If top 1 is perfect match remove the rest
    if (commands.length > 0 && commands[0][0] === 1) {
        commands = commands.filter((xs) => xs[0] === 1);
    }

    return {
        commands: commands.map(([s, c]) => c),
        queryTokens,
        tokenPositions: allTokenPositions,
    };
}

function commandVariables({
    action,
    gameEntities,
    queryTokens,
    tokenPositions,
}: {
    action: Action;
    gameEntities: GameActionEntities;
    queryTokens: string[];
    tokenPositions: TokenPositions;
}): GameCommandVariables {
    // All required tokens are relevant
    let relevantPositions = Object.values(action.predicate.tokens)
        .filter((t) => !t.optional)
        .map((c) => c.position);

    // Optional tokens if it appears
    for (const [t, { position, optional }] of Object.entries(
        action.predicate.tokens,
    )) {
        for (const [_, matchedTokenPosition] of Object.entries(
            tokenPositions,
        )) {
            for (const matchedPosition of Object.keys(matchedTokenPosition)) {
                if (parseInt(matchedPosition) === position) {
                    relevantPositions.push(position);
                }
            }
        }
    }

    const queryIrrelevant = Array.from(queryTokens.entries())
        .filter(([pos, token]) => {
            return !relevantPositions.includes(pos);
        })
        .map(([pos, token]) => token)
        .join(" ")
        .trim();

    return {
        query: queryTokens.join(" "),
        queryIrrelevant,
    };
}

function gameCommandScore(
    command: GameCommand,
    tokenPositions: TokenPositions,
    queryTokens: string[],
): number {
    // Note: don't include self, offer, receive
    const { target, item, skill } = command[1];
    const tokens = [gameActionId(command[0])];
    if (target) {
        tokens.push(getEntityId(target)[0]);
    }
    if (item) {
        tokens.push(getEntityId(item)[0]);
    }
    if (skill) {
        tokens.push(skill);
    }
    const tokenScore = tokens.reduce((acc, t) => {
        const matchedScore = tokenPositions[t];
        if (matchedScore) {
            return acc + Object.values(tokenPositions[t])[0].score;
        }
        return acc;
    }, 0);
    return tokenScore / queryTokens.length;
}

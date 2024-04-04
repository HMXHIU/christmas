import type {
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";

export { entitiesInfomationRetrieval, tokenize };

function tokenize(query: string): string[] {
    return query.split(/\s+/);
}

function tokenMatchAny(token: string, matchAny: string[]): number {
    // Fast path for exact matches
    if (matchAny.includes(token)) {
        return 1;
    }
    // Try to find a fuzzy match
    for (let document of matchAny) {
        if (fuzzyMatch(token, document, maxLevenshteinDistance(document))) {
            return 0.8;
        }
    }
    return 0;
}

function documentScore(queryTokens: string[], document: string): number {
    const documentTokens = tokenize(document);
    const denominator = documentTokens.length;
    if (denominator === 0) {
        return 0;
    }
    let numerator = 0;
    for (const token of queryTokens) {
        numerator += tokenMatchAny(token, documentTokens);
        if (numerator >= denominator) {
            return 1;
        }
    }
    return numerator / denominator;
}

function entitiesInfomationRetrieval(
    queryTokens: string[],
    entities: { monsters: Monster[]; players: Player[]; items: Item[] },
): { monsters: Monster[]; players: Player[]; items: Item[] } {
    let { monsters, players, items } = entities;

    monsters = monsters.filter((monster) => {
        const monsterDocuments = [monster.beast, monster.name, monster.monster];
        return monsterDocuments.some((document) => {
            return documentScore(queryTokens, document) > 0.6;
        });
    });

    players = players.filter((player) => {
        const playerDocuments = [player.name, player.player];
        return playerDocuments.some((document) => {
            return documentScore(queryTokens, document) > 0.6;
        });
    });

    items = items.filter((item) => {
        const itemDocuments = [item.name, item.item];
        return itemDocuments.some((document) => {
            return documentScore(queryTokens, document) > 0.6;
        });
    });

    return {
        monsters: monsters || [],
        players: players || [],
        items: items || [],
    };
}

function maxLevenshteinDistance(query: string): number {
    if (query.length <= 3) {
        return 0;
    } else if (query.length <= 4) {
        return 1;
    } else if (query.length <= 6) {
        return 2;
    }
    return 3;
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

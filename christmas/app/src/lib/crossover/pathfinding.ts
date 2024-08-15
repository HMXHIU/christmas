import { type Direction } from "$lib/crossover/world/types";
import { directionVectors } from "./utils";

export { aStarPathfinding };

interface Node {
    row: number;
    col: number;
    g: number;
    h: number;
    f: number;
    parent: Node | null;
}

/**
 * Performs A* pathfinding algorithm to find the optimal path between two points on a map.
 *
 * @param rowStart - The starting row index.
 * @param rowEnd - The ending row index.
 * @param colStart - The starting column index.
 * @param colEnd - The ending column index.
 * @param getTraversalCost - A function that returns the traversal cost for a given cell (0 is walkable, 1 is not).
 * @param range - Stop if within range (eg. ability range)
 * @returns An array of directions representing the optimal path (eg. [n, s, e, w]).
 */
async function aStarPathfinding({
    rowStart,
    rowEnd,
    colStart,
    colEnd,
    getTraversalCost,
    range,
    maxIterations,
}: {
    rowStart: number;
    rowEnd: number;
    colStart: number;
    colEnd: number;
    getTraversalCost: (row: number, col: number) => Promise<number>; // 0 is walkable, 1 is not
    maxIterations?: number;
    range?: number;
}): Promise<Direction[]> {
    maxIterations = maxIterations ?? 1000;

    const heuristic = (
        row: number,
        col: number,
        rowEnd: number,
        colEnd: number,
    ) => {
        return Math.abs(row - rowEnd) + Math.abs(col - colEnd); // Manhattan distance
    };

    const neighbors = async (node: Node): Promise<Node[]> => {
        const result: Node[] = [];
        for (const key in directionVectors) {
            const [dr, dc] = directionVectors[key as Direction];
            const newRow = node.row + dr;
            const newCol = node.col + dc;
            if ((await getTraversalCost(newRow, newCol)) === 0) {
                result.push({
                    row: newRow,
                    col: newCol,
                    g: node.g + 1,
                    h: heuristic(newRow, newCol, rowEnd, colEnd),
                    f: 0,
                    parent: node,
                });
            }
        }
        return result;
    };

    const reconstructPath = (node: Node): Direction[] => {
        const path: Direction[] = [];
        let current: Node | null = node;
        while (current && current.parent) {
            const dr = current.row - current.parent.row;
            const dc = current.col - current.parent.col;
            for (const key in directionVectors) {
                const [dRow, dCol] = directionVectors[key as Direction];
                if (dr === dRow && dc === dCol) {
                    path.push(key as Direction);
                    break;
                }
            }
            current = current.parent;
        }
        return path.reverse();
    };

    const openList: Node[] = [];
    const closedList: Set<string> = new Set();

    const startNode: Node = {
        row: rowStart,
        col: colStart,
        g: 0,
        h: heuristic(rowStart, colStart, rowEnd, colEnd),
        f: 0,
        parent: null,
    };
    startNode.f = startNode.g + startNode.h;
    openList.push(startNode);

    const isWithinRange = (
        row: number,
        col: number,
        range: number,
    ): boolean => {
        return heuristic(row, col, rowEnd, colEnd) <= range;
    };

    let iterations = 0;
    while (openList.length > 0 && iterations < maxIterations) {
        iterations++;

        openList.sort((a, b) => a.f - b.f); // Sort by f value
        const currentNode = openList.shift()!;
        const currentKey = `${currentNode.row},${currentNode.col}`;

        if (currentNode.row === rowEnd && currentNode.col === colEnd) {
            return reconstructPath(currentNode);
        }

        // Early exit if in range
        if (
            range != null &&
            isWithinRange(currentNode.row, currentNode.col, range)
        ) {
            return reconstructPath(currentNode);
        }

        closedList.add(currentKey);

        const neighborNodes = await neighbors(currentNode);
        for (const neighbor of neighborNodes) {
            const neighborKey = `${neighbor.row},${neighbor.col}`;
            if (closedList.has(neighborKey)) continue;

            const openNode = openList.find(
                (node) =>
                    node.row === neighbor.row && node.col === neighbor.col,
            );
            if (!openNode) {
                neighbor.f = neighbor.g + neighbor.h;
                openList.push(neighbor);
            } else if (neighbor.g < openNode.g) {
                openNode.g = neighbor.g;
                openNode.f = openNode.g + openNode.h;
                openNode.parent = currentNode;
            }
        }
    }

    return []; // No path found
}

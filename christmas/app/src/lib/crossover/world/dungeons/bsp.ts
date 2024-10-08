import { geohashToColRow, gridCellToGeohash } from "$lib/crossover/utils";
import {
    sampleFrom,
    seededRandom,
    stringToRandomNumber,
} from "$lib/utils/random";
import type { Room } from "./types";

export { generateRoomsBSP };

interface BSPNode {
    rows: number;
    cols: number;
    x: number;
    y: number;
    children?: [BSPNode, BSPNode];
    isLeaf: boolean;
}

function splitBSP(
    node: BSPNode,
    maxDepth: number,
    minDepth: number,
    curDepth: number,
): BSPNode {
    if (curDepth >= maxDepth) {
        node.isLeaf = true;
        return node;
    }

    // Get the seed using the origin
    let seed = stringToRandomNumber(`${node.x}${node.y}`);

    // Determine if the node should be split further
    const shouldSplit = seededRandom(seed++) > 0.5 || curDepth < minDepth;
    if (shouldSplit) {
        const [child1, child2] = splitNode(node, seed++);
        node.children = [
            splitBSP(child1, maxDepth, minDepth, curDepth + 1),
            splitBSP(child2, maxDepth, minDepth, curDepth + 1),
        ];
        node.isLeaf = false;
    } else {
        node.isLeaf = true;
    }

    return node;
}

function splitNode(node: BSPNode, seed: number): [BSPNode, BSPNode] {
    // Make sure the splitting don't result in extreme aspect ratios
    let splitHorizontally = seededRandom(seed) > 0.5;
    if (node.cols >= node.rows * 2) {
        splitHorizontally = false;
    } else if (node.rows >= node.cols * 2) {
        splitHorizontally = true;
    }

    if (splitHorizontally) {
        return [
            {
                rows: node.rows / 2,
                cols: node.cols,
                x: node.x,
                y: node.y,
                isLeaf: false,
            },
            {
                rows: node.rows / 2,
                cols: node.cols,
                x: node.x,
                y: node.y + node.rows / 2,
                isLeaf: false,
            },
        ];
    } else {
        return [
            {
                rows: node.rows,
                cols: node.cols / 2,
                x: node.x,
                y: node.y,
                isLeaf: false,
            },
            {
                rows: node.rows,
                cols: node.cols / 2,
                x: node.x + node.cols / 2,
                y: node.y,
                isLeaf: false,
            },
        ];
    }
}

function extractLeafNodes(node: BSPNode, leaves: BSPNode[] = []): BSPNode[] {
    if (node.isLeaf) {
        leaves.push(node);
    } else if (node.children) {
        extractLeafNodes(node.children[0], leaves);
        extractLeafNodes(node.children[1], leaves);
    }
    return leaves;
}

function generateRoomsBSP({
    geohash,
    minDepth,
    maxDepth,
    unitPrecision,
    numRooms,
}: {
    geohash: string;
    minDepth: number;
    maxDepth: number;
    unitPrecision: number;
    numRooms: number;
}): Room[] {
    // Use a numberic grid first, only at the final step after choosing the rooms, use gridCellToGeohash to convert it to geohash
    const geohashIsEven = geohash.length % 2 === 0;
    let rows = geohashIsEven ? 4 : 8;
    let cols = geohashIsEven ? 8 : 4;
    let origin = geohash;
    for (let i = 0; i < unitPrecision - geohash.length; i++) {
        if ((geohash.length + i) % 2 === 0) {
            rows *= 8;
            cols *= 4;
            origin += "p";
        } else {
            rows *= 4;
            cols *= 8;
            origin += "b";
        }
    }
    const [x, y] = geohashToColRow(origin);

    const rootNode: BSPNode = {
        rows,
        cols,
        x,
        y,
        isLeaf: false,
    };

    // Split the BSP tree (TODO: Can early return if numRooms is met)
    splitBSP(rootNode, maxDepth, minDepth, 0);

    // Extract leaf nodes as rooms
    const leafNodes = extractLeafNodes(rootNode);

    // Convert leaf nodes to rooms
    const rooms: Room[] = [];
    for (const node of leafNodes) {
        const { x, y, rows, cols } = node;
        const plots = new Set<string>();
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                plots.add(
                    gridCellToGeohash({
                        row: y + i,
                        col: x + j,
                        precision: unitPrecision,
                    }),
                );
            }
        }

        rooms.push({
            // Use the geohash at the center of the room as the room id
            room: gridCellToGeohash({
                row: y + rows / 2,
                col: x + cols / 2,
                precision: unitPrecision,
            }),
            plots,
            plotPrecision: unitPrecision,
            connections: [],
            entrances: [],
        });
    }

    return sampleFrom(rooms, numRooms, stringToRandomNumber(geohash));
}

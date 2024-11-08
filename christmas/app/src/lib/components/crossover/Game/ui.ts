import { getDirectionsToPosition } from "$lib/crossover/game";
import { getGameActionId, type GameCommand } from "$lib/crossover/ir";
import type { Actor, Player } from "$lib/crossover/types";
import { geohashNeighbour, getEntityId } from "$lib/crossover/utils";
import type { Ability } from "$lib/crossover/world/abilities";
import type { Action } from "$lib/crossover/world/actions";
import type { Utility } from "$lib/crossover/world/compendium";
import type { Direction, GeohashLocation } from "$lib/crossover/world/types";
import { KdTree } from "$lib/utils/kdtree";
import { Bounds, Container, Graphics } from "pixi.js";
import { get } from "svelte/store";
import { target } from "../../../../store";
import { entityContainers, type EntityContainer } from "./entities";
import { layers } from "./layers";
import { CELL_WIDTH, HALF_ISO_CELL_WIDTH } from "./settings";
import { calculatePosition, type Position } from "./utils";

export {
    clearAllHighlights,
    displayCommandPreview,
    displayMovementPath,
    displayTargetBox,
    drawMovementPath,
    hideMovementPath,
    hideRangeIndicator,
    hideTargetBox,
    screenToGeohash,
    updateScreenHitTesting,
};

// Note: `screenToGeohashKDtree` is exported as a reference do not recreate the entire object
const screenToGeohashKDtree: Partial<Record<GeohashLocation, KdTree<string>>> =
    {
        geohash: new KdTree<string>(2), // [screenX, screenY] => geohash
        d1: new KdTree<string>(2),
    };

const movementPath = new Graphics();
const rangeIndicator = new Graphics();
const targetBox = new Graphics();

function displayTargetBox(target: Actor | null) {
    if (!target) {
        hideTargetBox();
        return;
    }

    // Draw target box on target
    const [targetId] = getEntityId(target);
    const targetEC = entityContainers[targetId];
    if (targetEC) {
        drawTargetBox(targetEC);
    }
}

function hideTargetBox() {
    targetBox.removeFromParent();
    targetBox.clear();
}

function clearAllHighlights(highlight?: number) {
    for (const ec of Object.values(entityContainers)) {
        ec.clearHighlight(highlight);
    }
}

function updateScreenHitTesting(
    p: number[],
    locationType: GeohashLocation,
    geohash: string,
) {
    if (screenToGeohashKDtree[locationType]) {
        screenToGeohashKDtree[locationType].insert(p, geohash);
    } else {
        screenToGeohashKDtree[locationType] = new KdTree<string>(2);
        screenToGeohashKDtree[locationType].insert(p, geohash);
    }
}

function screenToGeohash(
    p: number[],
    locationType: GeohashLocation,
): string | null {
    const node = screenToGeohashKDtree[locationType]?.findNearest(p);
    if (node) {
        const { data, second } = node;
        return data;
    } else {
        return null;
    }
}

function drawMovementPath(
    points: [number, number][],
    stage: Container,
    smooth?: false,
) {
    movementPath.clear();

    if (points.length < 2) return;

    // TODO: fix smooth path (issue with arcs drawing esp on elevation)
    movementPath.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
        if (smooth) {
            movementPath.arcTo(
                points[i - 1][0],
                points[i - 1][1],
                points[i][0],
                points[i][1],
                HALF_ISO_CELL_WIDTH,
            );
        } else {
            movementPath.lineTo(points[i - 1][0], points[i - 1][1]);
        }
    }
    // Draw the last segment from the last arc tangent to the end
    const end = points.slice(-1)[0];
    movementPath.lineTo(...end);

    movementPath.stroke({ width: 2, color: 0xffd900 });

    // UI layer on top of everything else
    movementPath.zIndex = layers.layers.length + 1;
    stage.addChild(movementPath); // adding multiple times will move it to the last in the display list
}

function hideMovementPath() {
    movementPath.removeFromParent();
    // Hide range indicator at end of movement
    rangeIndicator.removeFromParent();
    // Retarget at end of movement
    const t = get(target);
    if (t) {
        displayTargetBox(t);
    }
}

function hideRangeIndicator() {
    rangeIndicator.removeFromParent();
}

async function displayMovementPath(
    startPosition: Position,
    path: Direction[],
    stage: Container,
): Promise<[number, number][]> {
    // Get movement path (in screen coordinates)
    const floatAboveGround = 0;
    const points: [number, number][] = [
        [
            startPosition.isoX,
            startPosition.isoY - startPosition.elevation - floatAboveGround,
        ],
    ];

    let prevGeohash = startPosition.geohash;
    for (const direction of path) {
        const curGeohash = geohashNeighbour(prevGeohash, direction);
        const { isoX, isoY, elevation } = await calculatePosition(
            curGeohash,
            startPosition.locationType,
            startPosition.locationInstance,
        );
        points.push([isoX, isoY - elevation - floatAboveGround]);
        prevGeohash = curGeohash;
    }

    drawMovementPath(points, stage);

    return points;
}

function displayRangeIndicator(
    endPoint: [number, number],
    range: number,
    stage: Container,
) {
    rangeIndicator.clear();
    rangeIndicator
        .circle(...endPoint, range * CELL_WIDTH)
        .stroke({ width: 2, color: 0xffd900 });
    rangeIndicator.scale.y = 0.5;
    rangeIndicator.zIndex = layers.layers.length + 1; // ui layer
    stage.addChild(rangeIndicator);
}

async function displayCommandPreview({
    command,
    player,
    playerPosition,
    target, // this is the store target not the command target
    stage,
}: {
    command: GameCommand | null;
    player: Player;
    playerPosition: Position;
    target: Actor | null;
    stage: Container;
}) {
    if (command == null) {
        hideRangeIndicator();
        hideMovementPath();
        if (target) {
            displayTargetBox(target); // retarget target after done with preview of command target
        }
        return;
    }

    const [ga, { self, target: commandTarget, item }] = command;
    const [gaId, gaType] = getGameActionId(ga);

    // Highlight target (prevent commandTarget from overriding target)
    displayTargetBox(target);

    if (commandTarget) {
        const [commandTargetId, commandTargetType] = getEntityId(commandTarget);
        const targetEC = entityContainers[commandTargetId];
        if (!targetEC) return;

        // Highlight command target
        displayTargetBox(commandTarget);

        // Ability
        if (gaType === "ability" && targetEC.isoPosition) {
            const ability = ga as Ability;

            // Get movement required to get in range
            const path = await getDirectionsToPosition(
                playerPosition,
                targetEC.isoPosition,
                targetEC.isoPosition.locationType,
                targetEC.isoPosition.locationInstance,
                { range: ability.range },
            );

            // Display movement
            const pathScreenPoints = await displayMovementPath(
                playerPosition,
                path,
                stage,
            );

            // Display range indicator
            if (pathScreenPoints.length > 0) {
                displayRangeIndicator(
                    pathScreenPoints.slice(-1)[0],
                    ability.range,
                    stage,
                );
            }
        }
        // Utility
        else if (gaType === "utility") {
            const utility = ga as Utility;
        }
        // Action
        else if (gaType === "action") {
            const action = ga as Action;

            // Display range indicator
            displayRangeIndicator(
                [
                    playerPosition.isoX,
                    playerPosition.isoY - playerPosition.elevation,
                ],
                action.range,
                stage,
            );
        }
    }
}

function drawTargetBox(ec: EntityContainer) {
    hideTargetBox();

    let bounds: Bounds | undefined = undefined;
    let scaleGfx = 1;

    // AvatarEntityContainer
    if ("avatar" in ec && ec.avatar.rootBone) {
        bounds = ec.avatar.getLocalBounds();
        scaleGfx = ec.scale.x;
    }
    // SimpleEntityContainer
    else if ("mesh" in ec && ec.mesh) {
        bounds = ec.getLocalBounds();
        scaleGfx = ec.scale.x;
    }

    if (bounds) {
        const { x, y, width, height } = bounds;
        ec.addChild(
            targetBox.roundRect(x, y, width, height, 25).stroke({
                width: Math.round(2 / scaleGfx),
                color: 0xffd900,
            }),
        );
    }
}

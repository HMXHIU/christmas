import { getDirectionsToPosition } from "$lib/crossover/game";
import { getGameActionId, type GameCommand } from "$lib/crossover/ir";
import type { Actor, Player } from "$lib/crossover/types";
import { geohashNeighbour, getEntityId } from "$lib/crossover/utils";
import type { Ability } from "$lib/crossover/world/abilities";
import type { Action } from "$lib/crossover/world/actions";
import type { Utility } from "$lib/crossover/world/compendium";
import type { Direction, GeohashLocation } from "$lib/crossover/world/types";
import { KdTree } from "$lib/utils/kdtree";
import { Container, Graphics } from "pixi.js";
import { entityContainers } from "./entities";
import { layers } from "./layers";
import { CELL_WIDTH } from "./settings";
import { calculatePosition, type Position } from "./utils";

export {
    clearAllHighlights,
    displayCommandPreview,
    displayMovementPath,
    drawMovementPath,
    drawTargetUI,
    hideMovementPath,
    hideRangeIndicator,
    screenToGeohash,
    updateScreenHitTesting,
};

// Note: `screenToGeohashKDtree` is exported as a reference do not recreate the entire object
let screenToGeohashKDtree: Partial<Record<GeohashLocation, KdTree<string>>> = {
    geohash: new KdTree<string>(2), // [screenX, screenY] => geohash
    d1: new KdTree<string>(2),
};

let movementPath = new Graphics();
let rangeIndicator = new Graphics();

function drawTargetUI({
    target,
    highlight,
}: {
    source: Actor;
    target: Actor | null;
    stage: Container;
    highlight: number;
}) {
    if (!target) {
        clearAllHighlights(highlight);
        return;
    }

    // Highlight target entity and unhighlight others
    const [targetId] = getEntityId(target);
    for (const [entityId, ec] of Object.entries(entityContainers)) {
        if (targetId === entityId) {
            ec.highlight(highlight);
        } else {
            ec.clearHighlight(highlight);
        }
    }

    // // Draw targetting line
    // const [sourceId] = getEntityId(source);
    // const sourcePosition = entityMeshes[sourceId].position;
    // const targetPosition = entityMeshes[targetId].position;
    // if (sourcePosition == null || targetPosition == null) {
    //     return;
    // }

    // const startX = sourcePosition.isoX;
    // const startY = sourcePosition.isoY - sourcePosition.elevation;
    // const endX = targetPosition.isoX;
    // const endY = targetPosition.isoY - targetPosition.elevation;

    // targettingLine.moveTo(startX, startY);
    // targettingLine.lineTo(endX, endY);
    // targettingLine.stroke({ width: 4, color: 0xffd900 });
    // stage.addChild(targettingLine);
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
    return screenToGeohashKDtree[locationType]?.findNearest(p)?.data ?? null;
}

function drawMovementPath(points: [number, number][], stage: Container) {
    movementPath.clear();
    if (points.length < 3) return;

    movementPath.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
        movementPath.arcTo(
            points[i - 1][0],
            points[i - 1][1],
            points[i][0],
            points[i][1],
            50,
        );
    }

    // Draw the last segment from the last arc tangent to the end
    const end = points.slice(-1)[0];
    movementPath.lineTo(...end);
    movementPath.stroke({ width: 2, color: 0xffd900 });
    movementPath.zIndex = layers.layers.length + 1; // ui layer on top of everything else

    stage.addChild(movementPath); // adding multiple times will move it to the last in the display list
}

function hideMovementPath() {
    movementPath.removeFromParent();
    rangeIndicator.removeFromParent(); // also need to hide the range indicator
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
    target,
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
        return;
    }

    const [ga, { self, target: commandTarget, item }] = command;
    const [gaId, gaType] = getGameActionId(ga);

    // Highlight target (prevent commandTarget from overriding target)
    drawTargetUI({
        target,
        highlight: 2,
        stage,
        source: player,
    });

    if (commandTarget) {
        const [commandTargetId, commandTargetType] = getEntityId(commandTarget);
        const targetEC = entityContainers[commandTargetId];
        if (!targetEC) return;

        // Highlight command target
        drawTargetUI({
            target: commandTarget,
            highlight: 3,
            stage: stage,
            source: player,
        });

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

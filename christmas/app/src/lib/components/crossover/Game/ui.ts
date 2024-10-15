import type { Actor } from "$lib/crossover/types";
import { getEntityId } from "$lib/crossover/utils";
import type { GeohashLocation } from "$lib/crossover/world/types";
import { KdTree } from "$lib/utils/kdtree";
import { Container } from "pixi.js";
import { entityContainers } from "./entities";

export {
    clearAllHighlights,
    drawTargetUI,
    screenToGeohash,
    updateScreenHitTesting,
};

// Note: `screenToGeohashKDtree` is exported as a reference do not recreate the entire object
let screenToGeohashKDtree: Partial<Record<GeohashLocation, KdTree<string>>> = {
    geohash: new KdTree<string>(2), // [screenX, screenY] => geohash
    d1: new KdTree<string>(2),
};

function drawTargetUI({
    target,
    highlight,
}: {
    source: Actor;
    target: Actor | null;
    stage: Container;
    highlight: number;
}) {
    if (target == null) {
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

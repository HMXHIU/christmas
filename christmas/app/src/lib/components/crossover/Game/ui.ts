import type { Item, Monster, Player } from "$lib/crossover/types";
import { getEntityId } from "$lib/crossover/utils";
import { Container } from "pixi.js";
import { entityContainers } from "./entities";

export { clearAllHighlights, drawTargetUI };

function drawTargetUI({
    target,
    highlight,
}: {
    source: Player | Monster | Item;
    target: Player | Monster | Item | null;
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

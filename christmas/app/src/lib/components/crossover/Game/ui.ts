import { getEntityId } from "$lib/crossover/utils";
import type {
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import { Container } from "pixi.js";
import type { EntityMesh } from "./utils";

export { clearAllHighlights, clearHighlights, drawTargetUI, highlightEntity };

function drawTargetUI({
    target,
    entityMeshes,
    highlight,
}: {
    source: Player | Monster | Item;
    target: Player | Monster | Item | null;
    entityMeshes: Record<string, EntityMesh>;
    stage: Container;
    highlight: number;
}) {
    if (target == null) {
        clearAllHighlights(entityMeshes, highlight);
        return;
    }

    // Highlight target entity and unhighlight others
    const [targetId] = getEntityId(target);
    for (const [entityId, entityMesh] of Object.entries(entityMeshes)) {
        if (targetId === entityId) {
            highlightEntity(entityMesh, highlight);
        } else {
            clearHighlights(entityMesh, highlight);
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

function clearAllHighlights(
    entityMeshes: Record<string, EntityMesh>,
    highlight?: number,
) {
    for (const entityMesh of Object.values(entityMeshes)) {
        clearHighlights(entityMesh, highlight);
    }
}

function clearHighlights(entityMesh: EntityMesh, highlight?: number) {
    if (highlight == null) {
        entityMesh.shaderGeometry.instanceHighlights.data.fill(0);
        entityMesh.shaderGeometry.instanceHighlights.update();
    } else {
        // Clear specific highlight
        for (
            var i = 0;
            i < entityMesh.shaderGeometry.instanceHighlights.data.length;
            i++
        ) {
            if (
                entityMesh.shaderGeometry.instanceHighlights.data[i] ===
                highlight
            ) {
                entityMesh.shaderGeometry.instanceHighlights.data[i] = 0;
            }
        }
        entityMesh.shaderGeometry.instanceHighlights.update();
    }
}

function highlightEntity(entityMesh: EntityMesh, highlight: number = 1) {
    entityMesh.shaderGeometry.instanceHighlights.data.fill(highlight);
    entityMesh.shaderGeometry.instanceHighlights.update();
}

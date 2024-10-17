import { crossoverCmdMove } from "$lib/crossover/client";
import { getDirectionsToPosition } from "$lib/crossover/game";
import { geohashToColRow } from "$lib/crossover/utils";
import type { Direction } from "$lib/crossover/world/types";
import type { Container, FederatedPointerEvent } from "pixi.js";
import { HALF_ISO_CELL_HEIGHT, HALF_ISO_CELL_WIDTH } from "./settings";
import { displayMovementPath, screenToGeohash } from "./ui";
import { getPlayerPosition, snapToGrid } from "./utils";

export { createHIDHandlers };

interface HIDState {
    path: Direction[] | null;
    lastCursorX: number;
    lastCursorY: number;
    isMouseDown: boolean;
}

function createHIDHandlers(stage: Container) {
    const state: HIDState = {
        path: null,
        lastCursorX: 0,
        lastCursorY: 0,
        isMouseDown: false,
    };

    function getMousePosition(
        e: FederatedPointerEvent,
    ): [number, number] | null {
        const playerPosition = getPlayerPosition();
        if (!playerPosition) return null;

        return snapToGrid(
            e.global.x + stage.pivot.x,
            e.global.y + stage.pivot.y,
            HALF_ISO_CELL_WIDTH,
            HALF_ISO_CELL_HEIGHT,
        );
    }

    function updateMouseState(
        e: FederatedPointerEvent,
    ): [number, number] | null {
        const snapXY = getMousePosition(e);
        if (!snapXY) return null;

        const [x, y] = snapXY;
        state.lastCursorX = x;
        state.lastCursorY = y;
        return snapXY;
    }

    async function handleMouseMove(e: FederatedPointerEvent) {
        const snapXY = updateMouseState(e);
        if (!snapXY) return;

        const [x, y] = snapXY;
        const playerPosition = getPlayerPosition();
        if (!playerPosition || !state.isMouseDown) return;

        // Convert screen coordinates to geohash
        const targetGeohash = screenToGeohash(
            [x, y],
            playerPosition.locationType,
        );
        if (targetGeohash) {
            // Get path directions using A*
            const [colEnd, rowEnd] = geohashToColRow(targetGeohash);
            state.path = await getDirectionsToPosition(
                playerPosition,
                {
                    row: rowEnd,
                    col: colEnd,
                },
                playerPosition.locationType,
                playerPosition.locationInstance,
            );
            await displayMovementPath(playerPosition, state.path, stage);
        }
    }

    async function handleMouseUp(e: FederatedPointerEvent) {
        const snapXY = updateMouseState(e);
        if (!snapXY) return;
        state.isMouseDown = false;

        // Initiate move command
        if (state.path && state.path.length > 0) {
            await crossoverCmdMove({ path: state.path });
        }
    }

    function handleMouseDown(e: FederatedPointerEvent) {
        const snapXY = updateMouseState(e);
        if (!snapXY) return;

        state.isMouseDown = true;
        state.path = null;
    }

    return {
        mouseMove: handleMouseMove,
        mouseUp: handleMouseUp,
        mouseDown: handleMouseDown,
    };
}

<script lang="ts">
    import {
        biomesAtTile,
        getCellFromTile,
        updateBiomesGrid,
        type Grid,
    } from "$lib/crossover/world";
    import {
        abyssTile,
        loadResources,
        type Resources,
    } from "$lib/crossover/world/resources";
    import type { TileSchema } from "$lib/server/crossover/router";
    import ngeohash from "ngeohash";
    import { onMount } from "svelte";
    import type { z } from "zod";

    const GRID_ROWS = 9;
    const GRID_COLS = 9;
    const GRID_MID_ROW = Math.floor(GRID_ROWS / 2);
    const GRID_MID_COL = Math.floor(GRID_COLS / 2);

    export let tile: z.infer<typeof TileSchema> = abyssTile;

    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D;
    let resources: Resources;

    // TODO: optimize updating the grid + load more data as player moves
    let biomesGrid: Grid = {};
    const parentTile = tile.tile.slice(0, tile.tile.length - 1);
    const neighbourTiles = ngeohash.neighbors(parentTile);
    biomesGrid = updateBiomesGrid(biomesGrid, biomesAtTile(parentTile));
    for (const t of neighbourTiles) {
        biomesGrid = updateBiomesGrid(biomesGrid, biomesAtTile(t));
    }

    let cell = getCellFromTile(tile.tile);

    function draw() {
        if (ctx && resources) {
            const { width, height } = canvas;
            const cellHeight = height / GRID_ROWS;
            const cellWidth = width / GRID_COLS;

            // Draw biome
            for (let row = 0; row < GRID_ROWS; row++) {
                for (let col = 0; col < GRID_COLS; col++) {
                    const biome =
                        biomesGrid?.[cell.precision]?.[
                            cell.row - GRID_MID_ROW + row
                        ]?.[cell.col - GRID_MID_COL + col];
                    const resource = resources.biomes?.[biome];
                    if (resource?.image && resource.isLoaded && resource.bbox) {
                        ctx.drawImage(
                            resource.image,
                            ...resource.bbox,
                            row * cellHeight,
                            col * cellWidth,
                            cellWidth,
                            cellHeight,
                        );
                    }
                }
            }

            // Draw player
            const resource = resources.avatars["knight"];
            if (resource?.image && resource.isLoaded && resource.bbox) {
                ctx.drawImage(
                    resource.image,
                    ...resource.bbox,
                    GRID_MID_ROW * cellHeight,
                    GRID_MID_COL * cellWidth,
                    cellWidth,
                    cellHeight,
                );
            }
        }
    }

    onMount(async () => {
        ctx = canvas.getContext("2d")!;
        resources = await loadResources();

        draw();
    });
</script>

<canvas width="200" height="200" bind:this={canvas}> </canvas>

<script lang="ts">
    import {
        biomesAtGeohash,
        geohashToCell,
        updateGrid,
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
    let grid: Grid = {};
    const parentGeohash = tile.geohash.slice(0, tile.geohash.length - 1);
    const neighbourTiles = ngeohash.neighbors(parentGeohash);

    // TODO: this should load everything even POI at different zoom levels
    grid = updateGrid(grid, biomesAtGeohash(parentGeohash));
    for (const t of neighbourTiles) {
        grid = updateGrid(grid, biomesAtGeohash(t));
    }

    $: draw(tile);

    function draw(tile: z.infer<typeof TileSchema>) {
        const cell = geohashToCell(tile.geohash);

        if (ctx && resources) {
            const { width, height } = canvas;
            const cellHeight = height / GRID_ROWS;
            const cellWidth = width / GRID_COLS;

            // Clear canvas
            ctx.clearRect(0, 0, width, height);

            // Draw biome
            for (let row = 0; row < GRID_ROWS; row++) {
                for (let col = 0; col < GRID_COLS; col++) {
                    const biome =
                        grid?.[cell.precision]?.[
                            cell.row - GRID_MID_ROW + row
                        ]?.[cell.col - GRID_MID_COL + col]?.biome;

                    const resource = resources.biomes?.[biome!];
                    if (resource?.image && resource.isLoaded && resource.bbox) {
                        ctx.drawImage(
                            resource.image,
                            ...resource.bbox,
                            col * cellWidth,
                            row * cellHeight,
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
                    GRID_MID_COL * cellWidth,
                    GRID_MID_ROW * cellHeight,
                    cellWidth,
                    cellHeight,
                );
            }
        }
    }

    onMount(async () => {
        ctx = canvas.getContext("2d")!;
        // TODO: optimize this, keeps reloading when map expands
        resources = await loadResources();
        draw(tile);
    });
</script>

<canvas width="200" height="200" bind:this={canvas}> </canvas>

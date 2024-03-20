<script lang="ts">
    import { abyssTile, geohashToCell } from "$lib/crossover/world";
    import type { TileSchema } from "$lib/server/crossover/router";
    import { onMount } from "svelte";
    import type { z } from "zod";
    import { grid } from "../../../store";

    import { biomes } from "$lib/crossover/world/biomes";
    import {
        AnimatedSprite,
        Application,
        Assets,
        Container,
        Sprite,
    } from "pixi.js";

    const CANVAS_WIDTH = 200;
    const CANVAS_HEIGHT = 200;
    const CANVAS_ROWS = 7;
    const CANVAS_COLS = 7;
    const CANVAS_MID_ROW = Math.floor(CANVAS_ROWS / 2);
    const CANVAS_MID_COL = Math.floor(CANVAS_COLS / 2);

    const OVERDRAW_MULTIPLE = 1;
    const WORLD_WIDTH = CANVAS_WIDTH * OVERDRAW_MULTIPLE;
    const WORLD_HEIGHT = CANVAS_HEIGHT * OVERDRAW_MULTIPLE;
    const WORLD_PIVOT_X = (WORLD_WIDTH - CANVAS_WIDTH) / 2;
    const WORLD_PIVOT_Y = (WORLD_HEIGHT - CANVAS_HEIGHT) / 2;

    const GRID_ROWS = CANVAS_ROWS * OVERDRAW_MULTIPLE;
    const GRID_COLS = CANVAS_COLS * OVERDRAW_MULTIPLE;
    const GRID_MID_ROW = Math.floor(GRID_ROWS / 2);
    const GRID_MID_COL = Math.floor(GRID_COLS / 2);

    const CELL_HEIGHT = WORLD_HEIGHT / GRID_ROWS;
    const CELL_WIDTH = WORLD_WIDTH / GRID_COLS;

    export let tile: z.infer<typeof TileSchema> = abyssTile;
    let prevTile: z.infer<typeof TileSchema> | null = null;

    let container: HTMLDivElement;

    const app = new Application();
    const world = new Container();

    interface GridSprite {
        sprite: Sprite;
        x: number;
        y: number;
    }

    let gridSprites: Record<number, Record<number, GridSprite>> = {};

    $: updateWorld(tile);

    function setGridSprite(row: number, col: number, gridSprite: GridSprite) {
        if (!gridSprites[row]) {
            gridSprites[row] = {};
        }
        gridSprites[row][col] = gridSprite;
    }

    async function drawPlayer(tile: z.infer<typeof TileSchema>) {
        const { player } = await Assets.loadBundle("player");
        const playerSprite = new AnimatedSprite(player.animations["stand"]);
        playerSprite.x = CANVAS_MID_COL * CELL_WIDTH;
        playerSprite.y = CANVAS_MID_ROW * CELL_HEIGHT;
        playerSprite.width = CELL_WIDTH;
        playerSprite.height = CELL_HEIGHT;
        playerSprite.animationSpeed = 0.1;
        playerSprite.play();
        // Add player (not in the world container - directly to stage, thus different coordinate system)
        app.stage.addChild(playerSprite);
    }

    function destroySprites({
        rowGreaterThan,
        rowLessThan,
        colGreaterThan,
        colLessThan,
    }: {
        rowGreaterThan?: number;
        rowLessThan?: number;
        colGreaterThan?: number;
        colLessThan?: number;
    }) {
        for (const row of Object.keys(gridSprites).map(Number)) {
            if (rowGreaterThan != null && !(row > rowGreaterThan)) {
                continue;
            }
            if (rowLessThan != null && !(row < rowLessThan)) {
                continue;
            }

            for (const col of Object.keys(gridSprites[row]).map(Number)) {
                if (colGreaterThan != null && !(col > colGreaterThan)) {
                    continue;
                }
                if (colLessThan != null && !(col < colLessThan)) {
                    continue;
                }

                gridSprites[row][col].sprite.destroy();
                delete gridSprites[row][col];
            }

            if (Object.keys(gridSprites[row]).length === 0) {
                delete gridSprites[row];
            }
        }
    }

    async function fillInGrid({
        cell,
        colStart,
        colEnd,
        rowStart,
        rowEnd,
        alpha,
    }: {
        cell: { precision: number; row: number; col: number };
        colStart?: number;
        colEnd?: number;
        rowStart?: number;
        rowEnd?: number;
        alpha?: number;
    }) {
        rowStart ??= 0;
        rowEnd ??= GRID_ROWS;
        colStart ??= 0;
        colEnd ??= GRID_COLS;
        alpha ??= 1;

        for (let row: number = rowStart; row < rowEnd; row++) {
            const gridRow = cell.row - GRID_MID_ROW + row;

            for (let col: number = colStart; col < colEnd; col++) {
                const gridCol = cell.col - GRID_MID_COL + col;

                const biome =
                    $grid?.[cell.precision]?.[gridRow]?.[gridCol]?.biome;

                if (!biome) continue;
                const asset = biomes[biome].asset;
                if (!asset) continue;
                const bundle = await Assets.loadBundle(asset.bundle);
                const frame =
                    bundle[asset.name].textures[asset.variants!.default];
                if (!frame) continue;

                const sprite = new Sprite(frame);
                sprite.x = col * CELL_WIDTH;
                sprite.y = row * CELL_HEIGHT;
                sprite.width = CELL_WIDTH;
                sprite.height = CELL_HEIGHT;
                sprite.alpha = alpha;

                setGridSprite(gridRow, gridCol, {
                    sprite: world.addChild(sprite),
                    x: sprite.x,
                    y: sprite.y,
                });
            }
        }
    }

    async function updateWorld(tile: z.infer<typeof TileSchema>) {
        if (prevTile != null) {
            const cell = geohashToCell(tile.geohash);
            const prevCell = geohashToCell(prevTile.geohash);

            if (cell.precision === prevCell.precision) {
                const deltaCol = cell.col - prevCell.col;
                const deltaRow = cell.row - prevCell.row;

                function calculateStartEnd(delta: number, gridSize: number) {
                    if (delta > 0) {
                        return [gridSize, gridSize + delta];
                    } else if (delta < 0) {
                        return [delta, 0];
                    } else {
                        return [undefined, undefined];
                    }
                }

                const [rowStart, rowEnd] = calculateStartEnd(
                    deltaRow,
                    GRID_ROWS,
                );
                const [colStart, colEnd] = calculateStartEnd(
                    deltaCol,
                    GRID_COLS,
                );

                // Update columns
                if (deltaCol !== 0) {
                    await fillInGrid({
                        cell: prevCell,
                        colStart,
                        colEnd,
                    });
                    destroySprites({
                        colGreaterThan: cell.col + GRID_MID_COL,
                        colLessThan: cell.col - GRID_MID_COL,
                    });
                }

                // Update columns
                if (deltaRow !== 0) {
                    await fillInGrid({
                        cell: prevCell,
                        rowStart,
                        rowEnd,
                    });
                    destroySprites({
                        rowGreaterThan: cell.row + GRID_MID_ROW,
                        rowLessThan: cell.row - GRID_MID_ROW,
                    });
                }

                // Update diagonals
                if (deltaCol !== 0 && deltaRow !== 0) {
                    await fillInGrid({
                        cell: prevCell,
                        rowStart,
                        rowEnd,
                        colStart,
                        colEnd,
                    });
                    destroySprites({
                        rowGreaterThan: cell.row + GRID_MID_ROW,
                        rowLessThan: cell.row - GRID_MID_ROW,
                        colGreaterThan: cell.col + GRID_MID_COL,
                        colLessThan: cell.col - GRID_MID_COL,
                    });
                }

                // Update sprite target positions
                if (deltaCol !== 0 || deltaRow !== 0) {
                    Object.values(gridSprites).forEach((row) => {
                        Object.values(row).forEach((gridSprite) => {
                            gridSprite.x -= deltaCol * CELL_WIDTH;
                            gridSprite.y -= deltaRow * CELL_HEIGHT;
                        });
                    });
                }
            }
        }

        prevTile = { ...tile }; // copy, do not set by reference
    }

    onMount(async () => {
        await app.init({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT });

        // Add the world container
        world.width = WORLD_WIDTH;
        world.height = WORLD_HEIGHT;
        world.pivot.x = WORLD_PIVOT_X;
        world.pivot.y = WORLD_PIVOT_Y;
        app.stage.addChild(world);

        await drawPlayer(tile);
        await fillInGrid({
            cell: geohashToCell(tile.geohash),
            colStart: 0,
            colEnd: GRID_COLS,
        });

        // Ticker
        app.ticker.add((deltaTime) => {
            // Move sprites to their target positions
            Object.values(gridSprites).forEach((row) => {
                Object.values(row).forEach((gridSprite) => {
                    gridSprite.sprite.x +=
                        ((gridSprite.x - gridSprite.sprite.x) *
                            deltaTime.elapsedMS) /
                        100;
                    gridSprite.sprite.y +=
                        ((gridSprite.y - gridSprite.sprite.y) *
                            deltaTime.elapsedMS) /
                        100;
                });
            });
        });

        // Add the canvas to the DOM
        container.appendChild(app.canvas);
    });
</script>

<div bind:this={container}></div>

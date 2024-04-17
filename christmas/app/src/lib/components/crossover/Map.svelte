<script lang="ts">
    import { geohashToGridCell, type Grid } from "$lib/crossover/world";
    import { playerAsset } from "$lib/crossover/world/player";
    import {
        bestiary,
        biomes,
        compendium,
    } from "$lib/crossover/world/settings";
    import type { TileSchema } from "$lib/server/crossover/router";
    import {
        AnimatedSprite,
        Application,
        Assets,
        Container,
        Sprite,
    } from "pixi.js";
    import { onMount } from "svelte";
    import type { z } from "zod";
    import { grid, player, tile } from "../../../store";

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

    const app = new Application();
    const world = new Container();

    let container: HTMLDivElement;
    let prevTile: z.infer<typeof TileSchema> | null = null;

    interface GridSprite {
        id: string;
        sprite: Sprite;
        x: number;
        y: number;
    }

    /**
     * Example: gridSprites[row][col][monster|player|item|biome] = {sprite, x, y}
     * [monster|player|item|biome] is a unique identifier (w.r.t the grid cell to allow update)
     */
    let gridSprites: Record<
        number,
        Record<number, Record<string, GridSprite>>
    > = {};

    $: updateWorld($tile, $grid);

    function setGridSprite(row: number, col: number, gridSprite: GridSprite) {
        gridSprites[row] ??= {};
        gridSprites[row][col] ??= {};
        gridSprites[row][col][gridSprite.id] = gridSprite;
    }

    async function drawPlayer() {
        // TODO: use playerAsset
        const { player: playerBundle } = await Assets.loadBundle("player");
        const playerSprite = new AnimatedSprite(
            playerBundle.animations["stand"],
        );
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

                // Destroy all sprites in this grid cell
                for (const [id, gs] of Object.entries(gridSprites[row][col])) {
                    gs.sprite.destroy();
                    delete gridSprites[row][col][id];
                }
                delete gridSprites[row][col];
            }

            if (Object.keys(gridSprites[row]).length === 0) {
                delete gridSprites[row];
            }
        }
    }

    async function loadSprite({
        asset,
        col,
        row,
        alpha,
        variant,
    }: {
        asset: any;
        col: number;
        row: number;
        alpha: number;
        variant?: string;
    }) {
        const bundle = await Assets.loadBundle(asset.bundle);
        const frame =
            bundle[asset.name]?.textures[variant ?? asset.variants!.default];
        if (!frame) return null;

        const sprite = new Sprite(frame);
        sprite.x = col * CELL_WIDTH;
        sprite.y = row * CELL_HEIGHT;
        sprite.width = CELL_WIDTH;
        sprite.height = CELL_HEIGHT;
        sprite.alpha = alpha;

        return sprite;
    }

    async function fillInGrid(
        g: Grid,
        {
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
        },
    ) {
        rowStart ??= 0;
        rowEnd ??= GRID_ROWS;
        colStart ??= 0;
        colEnd ??= GRID_COLS;
        alpha ??= 1;

        for (let row: number = rowStart; row < rowEnd; row++) {
            const gridRow = cell.row - GRID_MID_ROW + row;

            for (let col: number = colStart; col < colEnd; col++) {
                const gridCol = cell.col - GRID_MID_COL + col;

                // Fill in biome
                const biome = g[cell.precision]?.[gridRow]?.[gridCol]?.biome;
                if (biome) {
                    const asset = biomes[biome].asset;
                    if (asset) {
                        const sprite = await loadSprite({
                            asset,
                            col,
                            row,
                            alpha,
                        });
                        if (sprite) {
                            setGridSprite(gridRow, gridCol, {
                                id: "biome",
                                sprite: world.addChild(sprite),
                                x: sprite.x,
                                y: sprite.y,
                            });
                        }
                    }
                }

                // Fill in players
                const players =
                    g[cell.precision]?.[gridRow]?.[gridCol]?.players;
                if (players) {
                    for (const p of Object.values(players)) {
                        // Skip the current player
                        if (p.player === $player?.player) {
                            continue;
                        }

                        const sprite = await loadSprite({
                            asset: playerAsset,
                            col,
                            row,
                            alpha,
                        });
                        if (sprite) {
                            setGridSprite(gridRow, gridCol, {
                                id: p.player,
                                sprite: world.addChild(sprite),
                                x: sprite.x,
                                y: sprite.y,
                            });
                        }
                    }
                }

                // Fill in items (TODO: account for items with > 1 cell)
                const items = g[cell.precision]?.[gridRow]?.[gridCol]?.items;
                if (items) {
                    for (const item of Object.values(items)) {
                        const asset = compendium[item.prop]?.asset;
                        if (asset) {
                            const sprite = await loadSprite({
                                asset,
                                col,
                                row,
                                alpha,
                                variant: asset.variants?.[item.state],
                            });
                            if (sprite) {
                                setGridSprite(gridRow, gridCol, {
                                    id: item.item,
                                    sprite: world.addChild(sprite),
                                    x: sprite.x,
                                    y: sprite.y,
                                });
                            }
                        }
                    }
                }

                // Fill in monsters (TODO: account for items with > 1 cell)
                const monsters =
                    g[cell.precision]?.[gridRow]?.[gridCol]?.monsters;
                if (monsters) {
                    for (const monster of Object.values(monsters)) {
                        const asset = bestiary[monster.beast]?.asset;
                        if (asset) {
                            const sprite = await loadSprite({
                                asset,
                                col,
                                row,
                                alpha,
                            });
                            if (sprite) {
                                setGridSprite(gridRow, gridCol, {
                                    id: monster.monster,
                                    sprite: world.addChild(sprite),
                                    x: sprite.x,
                                    y: sprite.y,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    async function updateWorld(t: z.infer<typeof TileSchema>, g: Grid) {
        if (prevTile != null) {
            const cell = geohashToGridCell(t.geohash);
            const prevCell = geohashToGridCell(prevTile.geohash);

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
                    await fillInGrid(g, {
                        cell: prevCell,
                        colStart,
                        colEnd,
                    });
                    destroySprites({
                        colGreaterThan: cell.col + GRID_MID_COL,
                        colLessThan: cell.col - GRID_MID_COL,
                    });
                }

                // Update rows
                if (deltaRow !== 0) {
                    await fillInGrid(g, {
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
                    await fillInGrid(g, {
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

                // Update grid (due to change in grid entities)
                if (deltaCol === 0 && deltaRow === 0) {
                    destroySprites({});
                    await fillInGrid(g, {
                        cell,
                        colStart: 0,
                        colEnd: GRID_COLS,
                    });
                }

                // Update sprite target positions
                if (deltaCol !== 0 || deltaRow !== 0) {
                    for (const row of Object.values(gridSprites)) {
                        for (const gridSprite of Object.values(row)) {
                            for (const gs of Object.values(gridSprite)) {
                                gs.x -= deltaCol * CELL_WIDTH;
                                gs.y -= deltaRow * CELL_HEIGHT;
                            }
                        }
                    }
                }
            }
        }

        prevTile = { ...t }; // copy, do not set by reference
    }

    onMount(async () => {
        await app.init({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT });

        // Add the world container
        world.width = WORLD_WIDTH;
        world.height = WORLD_HEIGHT;
        world.pivot.x = WORLD_PIVOT_X;
        world.pivot.y = WORLD_PIVOT_Y;
        app.stage.addChild(world);

        await drawPlayer();
        await fillInGrid($grid, {
            cell: geohashToGridCell($tile.geohash),
            colStart: 0,
            colEnd: GRID_COLS,
        });

        // Ticker
        app.ticker.add((deltaTime) => {
            // Move sprites to their target positions
            for (const row of Object.values(gridSprites)) {
                for (const gss of Object.values(row)) {
                    for (const gs of Object.values(gss)) {
                        gs.sprite.x +=
                            ((gs.x - gs.sprite.x) * deltaTime.elapsedMS) / 100;
                        gs.sprite.y +=
                            ((gs.y - gs.sprite.y) * deltaTime.elapsedMS) / 100;
                    }
                }
            }
        });

        // Add the canvas to the DOM
        container.appendChild(app.canvas);
    });
</script>

<div bind:this={container}></div>

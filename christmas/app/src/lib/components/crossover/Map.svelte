<script lang="ts">
    import { seededRandom } from "$lib/crossover/utils";
    import {
        geohashToGridCell,
        type AssetMetadata,
        type Grid,
    } from "$lib/crossover/world";
    import { playerAsset } from "$lib/crossover/world/player";
    import {
        bestiary,
        biomes,
        compendium,
    } from "$lib/crossover/world/settings";
    import type { TileSchema } from "$lib/server/crossover/router";
    import {
        Application,
        Assets,
        Container,
        Graphics,
        Sprite,
        Texture,
    } from "pixi.js";
    import { onMount } from "svelte";
    import type { z } from "zod";
    import { grid, player, tile } from "../../../store";

    type SpriteLayer = "biome" | "entity";

    const BIOME_ZLAYER = 0;
    const ENTITIES_ZLAYER = 1000000000;

    let playerAvatar = "/sprites/portraits/female_drow.jpeg";
    let playerTexture: Texture;
    let playerSprite: Sprite;

    const CELL_WIDTH = 64;
    const CELL_HEIGHT = CELL_WIDTH;

    const CANVAS_ROWS = 7;
    const CANVAS_COLS = 7;
    const CANVAS_WIDTH = CELL_WIDTH * CANVAS_COLS;
    const CANVAS_HEIGHT = CELL_HEIGHT * CANVAS_ROWS; // TODO: wrong calculation
    const CANVAS_MID_ROW = Math.floor(CANVAS_ROWS / 2);
    const CANVAS_MID_COL = Math.floor(CANVAS_COLS / 2);

    const OVERDRAW_MULTIPLE = 2;
    const WORLD_WIDTH = CANVAS_WIDTH * OVERDRAW_MULTIPLE;
    const WORLD_HEIGHT = CANVAS_HEIGHT * OVERDRAW_MULTIPLE;
    const WORLD_PIVOT_X = (WORLD_WIDTH - CANVAS_WIDTH) / 2;
    const WORLD_PIVOT_Y = (WORLD_HEIGHT - CANVAS_HEIGHT) / 2;

    const GRID_ROWS = CANVAS_ROWS * OVERDRAW_MULTIPLE;
    const GRID_COLS = CANVAS_COLS * OVERDRAW_MULTIPLE;
    const GRID_MID_ROW = Math.floor(GRID_ROWS / 2);
    const GRID_MID_COL = Math.floor(GRID_COLS / 2);

    const app = new Application();
    const worldStage = new Container();

    let container: HTMLDivElement;
    let prevTile: z.infer<typeof TileSchema> | null = null;

    interface GridSprite {
        id: string;
        sprite: Sprite;
        x: number;
        y: number;
        layerType: SpriteLayer;
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

    /**
     * Rotate clockwise by 45 degrees, scale vertically by 0.5
     *
     * [x, y] * [ 0.5  0.25 ]
     *          [ -0.5 0.25 ]
     */
    function cartToIso(x: number, y: number) {
        return [x * 0.5 + y * -0.5, x * 0.25 + y * 0.25];
    }

    async function loadSprite({
        asset,
        col,
        row,
        alpha,
        layerType,
        variant,
        width,
        height,
        seed,
    }: {
        asset: AssetMetadata;
        col: number;
        row: number;
        alpha: number;
        layerType: SpriteLayer;
        variant?: string;
        width?: number;
        height?: number;
        seed?: number; // seed used for any random generators
    }) {
        width ??= 1;
        height ??= 1;
        seed ??= 0;
        const bundle = await Assets.loadBundle(asset.bundle);

        // Determine variant
        if (variant == null) {
            if (asset.prob != null) {
                const rv = seededRandom(seed);
                const entries = Object.entries(asset.prob);
                let acc = entries[0][1];
                variant = entries[0][0];
                for (const [v, p] of Object.entries(asset.prob)) {
                    if (rv < acc) {
                        variant = v;
                        break;
                    } else {
                        acc += p;
                    }
                }
            }
        }
        variant ??= "default";

        const frame =
            bundle[asset.name]?.textures[
                asset.variants?.[variant] || "default"
            ];
        if (!frame) return null;
        const sprite = new Sprite(frame);

        // Convert cartesian to isometric
        const [isoX, isoY] = cartToIso(col * CELL_WIDTH, row * CELL_HEIGHT);
        sprite.x = isoX;
        sprite.y = isoY;
        sprite.anchor.set(0.5); // TODO: set anchor in sprite.json not here as each asset is different

        sprite.width = CELL_WIDTH * width; // TODO: remove this scale image to 64 pix per grid
        sprite.height = (frame.height * sprite.width) / frame.width; // maintain aspect ratio
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
            cell: { precision: number; row: number; col: number }; // the center cell
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

                // Destroy existing sprites in this grid cell
                if (gridSprites?.[gridRow]?.[gridCol] != null) {
                    for (const [id, gs] of Object.entries(
                        gridSprites[gridRow][gridCol],
                    )) {
                        gs.sprite.destroy();
                        delete gridSprites[gridRow][gridCol][id];
                    }
                }

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
                            layerType: "biome",
                            seed: gridRow * 1000 + gridCol,
                        });

                        if (sprite) {
                            setGridSprite(gridRow, gridCol, {
                                id: "biome",
                                sprite: worldStage.addChild(sprite),
                                x: sprite.x,
                                y: sprite.y,
                                layerType: "biome",
                            });
                            // Set z-index based on y-coordinate & layer
                            sprite.zIndex = BIOME_ZLAYER + gridRow + gridCol;
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
                            layerType: "entity",
                        });
                        if (sprite) {
                            setGridSprite(gridRow, gridCol, {
                                id: p.player,
                                sprite: worldStage.addChild(sprite),
                                x: sprite.x,
                                y: sprite.y,
                                layerType: "entity",
                            });
                            // Set z-index based on y-coordinate & layer
                            sprite.zIndex = ENTITIES_ZLAYER + gridRow + gridCol;
                        }
                    }
                }

                // Fill in items
                const items = g[cell.precision]?.[gridRow]?.[gridCol]?.items;
                if (items) {
                    for (const item of Object.values(items)) {
                        const asset = compendium[item.prop]?.asset;
                        if (asset) {
                            const { variants, width, height } = asset;
                            const sprite = await loadSprite({
                                asset,
                                col,
                                row,
                                alpha,
                                variant: variants?.[item.state],
                                width,
                                height,
                                layerType: "entity",
                            });
                            if (sprite) {
                                setGridSprite(gridRow, gridCol, {
                                    id: item.item,
                                    sprite: worldStage.addChild(sprite),
                                    x: sprite.x,
                                    y: sprite.y,
                                    layerType: "entity",
                                });
                                // Set z-index based on y-coordinate & layer
                                sprite.zIndex =
                                    ENTITIES_ZLAYER + gridRow + gridCol;
                            }
                        }
                    }
                }

                // Fill in monsters
                const monsters =
                    g[cell.precision]?.[gridRow]?.[gridCol]?.monsters;
                if (monsters) {
                    for (const monster of Object.values(monsters)) {
                        const asset = bestiary[monster.beast]?.asset;
                        if (asset) {
                            const { width, height } = asset;
                            const sprite = await loadSprite({
                                asset,
                                col,
                                row,
                                alpha,
                                width,
                                height,
                                layerType: "entity",
                            });
                            if (sprite) {
                                setGridSprite(gridRow, gridCol, {
                                    id: monster.monster,
                                    sprite: worldStage.addChild(sprite),
                                    x: sprite.x,
                                    y: sprite.y,
                                    layerType: "entity",
                                });
                                // Set z-index based on y-coordinate & layer
                                sprite.zIndex =
                                    ENTITIES_ZLAYER + gridRow + gridCol;
                            }
                        }
                    }
                }
            }
        }
    }

    async function updateWorld(t: z.infer<typeof TileSchema>, g: Grid) {
        const cell = geohashToGridCell(t.geohash);

        // Player
        if (playerSprite != null && cell != null) {
            const [isoX, isoY] = cartToIso(
                GRID_MID_COL * CELL_WIDTH,
                GRID_MID_ROW * CELL_HEIGHT,
            );
            playerSprite.x = isoX;
            playerSprite.y = isoY - CELL_HEIGHT / 4; // isometric cell height is half of cartesian cell height
            playerSprite.zIndex = ENTITIES_ZLAYER + playerSprite.y;
        }

        // Environment
        if (prevTile != null) {
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

                // Update sprite target positions (gs.sprite.x -> gs.x)
                if (deltaCol !== 0 || deltaRow !== 0) {
                    const [isoX, isoY] = cartToIso(
                        deltaCol * CELL_WIDTH,
                        deltaRow * CELL_HEIGHT,
                    );
                    for (const row of Object.values(gridSprites)) {
                        for (const gridSprite of Object.values(row)) {
                            for (const gs of Object.values(gridSprite)) {
                                gs.x -= isoX;
                                gs.y -= isoY;
                            }
                        }
                    }
                }
            }
        }

        // Update the previous tile (copy, do not set by reference)
        prevTile = { ...t };
    }

    function createCreatureSprite(
        texture: Texture,
        pedestalTexture: Texture,
    ): Sprite {
        const sprite = new Sprite(playerTexture);

        const anchorY = 0.92;
        sprite.anchor.set(0.5, anchorY);

        const width = texture.height / 3;
        const yTop = texture.height * anchorY;
        const yTip = texture.height * (1 - anchorY);
        const halfW = width / 2;
        const shape = [
            {
                x: -halfW,
                y: -yTop,
            },
            {
                x: halfW,
                y: -yTop,
            },
            {
                x: halfW,
                y: 0,
            },
            {
                x: 0,
                y: yTip,
            },
            {
                x: -halfW,
                y: 0,
            },
        ];

        // Banner mask
        const mask = new Graphics();
        mask.poly(shape);
        mask.fill();
        sprite.mask = mask;
        sprite.addChild(mask);

        // Banner border
        const bannerBorder = new Graphics();
        bannerBorder.poly(shape);
        bannerBorder.stroke({ width: 30, color: 0x000000 });
        sprite.addChild(bannerBorder);

        // Scale to grid cell (slightly smaller) while maintaining aspect ratio
        sprite.width = texture.width / (width / (CELL_WIDTH - 20));
        sprite.height = (texture.height * sprite.width) / texture.width;

        // Pedastal
        const pedestal = new Sprite(pedestalTexture);
        pedestal.width = CELL_WIDTH;
        pedestal.height =
            (pedestalTexture.height * pedestal.width) / pedestalTexture.width;
        pedestal.anchor.set(0.5); // TODO: set in sprite.json

        const parent = new Sprite();
        parent.addChild(pedestal);
        parent.addChild(sprite);

        return parent;
    }

    onMount(async () => {
        await app.init({
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            antialias: false,
        });

        // Add world container
        worldStage.width = WORLD_WIDTH;
        worldStage.height = WORLD_HEIGHT;
        const [wpIsoX, wpIsoY] = cartToIso(WORLD_PIVOT_X, WORLD_PIVOT_Y);
        worldStage.pivot.x =
            wpIsoX +
            Math.floor(CELL_WIDTH / 2) -
            Math.floor((GRID_COLS * CELL_WIDTH) / 2) +
            (WORLD_PIVOT_X - wpIsoX);
        worldStage.pivot.y = wpIsoY / 2 - CELL_WIDTH / 2;
        app.stage.addChild(worldStage);

        // Player sprite
        playerTexture = await Assets.load(playerAvatar);
        const pedestalBundle = await Assets.loadBundle("pedestals");
        const pedestalTexture =
            pedestalBundle["pedestals"].textures["square_dirt_high"];
        playerSprite = createCreatureSprite(playerTexture, pedestalTexture);
        worldStage.addChild(playerSprite);

        await fillInGrid($grid, {
            cell: geohashToGridCell($tile.geohash),
            colStart: 0,
            colEnd: GRID_COLS,
        });
        await updateWorld($tile, $grid);

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

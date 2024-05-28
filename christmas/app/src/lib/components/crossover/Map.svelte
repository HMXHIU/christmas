<script lang="ts">
    import { LRUMemoryCache, memoize } from "$lib/caches";
    import {
        topologyBufferCache,
        topologyResponseCache,
        topologyResultCache,
    } from "$lib/crossover/caches";
    import {
        autoCorrectGeohashPrecision,
        cartToIso,
        entityId,
        generateEvenlySpacedPoints,
        seededRandom,
        stringToRandomNumber,
    } from "$lib/crossover/utils";
    import {
        geohashToGridCell,
        gridCellToGeohash,
        type AssetMetadata,
        type GridCell,
    } from "$lib/crossover/world";
    import {
        biomeAtGeohash,
        heightAtGeohash,
    } from "$lib/crossover/world/biomes";
    import {
        bestiary,
        biomes,
        compendium,
        worldSeed,
    } from "$lib/crossover/world/settings";
    import type {
        Item,
        Monster,
        Player,
        World,
    } from "$lib/server/crossover/redis/entities";
    import { cn } from "$lib/shadcn";
    import {
        Application,
        Assets,
        Container,
        Graphics,
        Sprite,
        Texture,
        Ticker,
        WebGLRenderer,
    } from "pixi.js";
    import { onMount } from "svelte";
    import {
        itemRecord,
        monsterRecord,
        player,
        playerRecord,
        worldRecord,
    } from "../../../store";
    import {
        MAX_SHADER_GEOMETRIES,
        loadShaderGeometry,
        updateShaderUniforms,
    } from "./shaders";

    let container: HTMLDivElement;
    let isInitialized = false;

    let playerAvatar = "/sprites/portraits/female_drow.jpeg";
    let playerTexture: Texture;
    let playerSprite: Sprite;

    let clientWidth: number;
    let clientHeight: number;

    // Note: this are cartesian coordinates (CELL_HEIGHT = CELL_WIDTH;)
    const CELL_WIDTH = 64;
    const CELL_HEIGHT = CELL_WIDTH;
    const CANVAS_ROWS = 7;
    const CANVAS_COLS = 7;
    const OVERDRAW_MULTIPLE = 3;
    const CANVAS_WIDTH = CELL_WIDTH * CANVAS_COLS;
    const CANVAS_HEIGHT = CELL_HEIGHT * CANVAS_ROWS;
    const WORLD_WIDTH = CANVAS_WIDTH * OVERDRAW_MULTIPLE;
    const WORLD_HEIGHT = CANVAS_HEIGHT * OVERDRAW_MULTIPLE;
    const GRID_ROWS = CANVAS_ROWS * OVERDRAW_MULTIPLE;
    const GRID_COLS = CANVAS_COLS * OVERDRAW_MULTIPLE;
    const GRID_MID_ROW = Math.floor(GRID_ROWS / 2);
    const GRID_MID_COL = Math.floor(GRID_COLS / 2);

    // Z layers
    const isoGridY = cartToIso(
        GRID_COLS * CELL_WIDTH,
        GRID_ROWS * CELL_HEIGHT,
    )[1];
    const Z_LAYERS: Record<string, number> = {
        ground: 0,
        biome: 0,
        floor: isoGridY,
        hip: 2 * isoGridY,
        item: 2 * isoGridY,
        humanoid: 3 * isoGridY,
        monster: 3 * isoGridY,
        player: 3 * isoGridY,
        wall: 3 * isoGridY,
        l2: 4 * isoGridY,
        l3: 5 * isoGridY,
        l4: 6 * isoGridY,
    };

    // In WebGL, the gl_Position.z value should be in the range [-1 (closer), 1]
    const Z_SCALE = -1 / (Z_LAYERS.l4 + isoGridY);
    const TOPOLOGICAL_HEIGHT_SCALE = CELL_HEIGHT / 2 / 8; // 1 meter = 1/8 a cell height (on isometric coordinates)

    let app: Application | null = null;
    let worldStage: Container | null = null;

    interface ShaderTexturePositions {
        texture: Texture;
        positions: Float32Array;
        width: number;
        height: number;
        length: number;
    }

    interface GridSprite {
        id: string;
        sprite: Sprite | Container;
        x: number; // in isometric
        y: number;
        row: number; // in cells
        col: number;
        variant?: string;
        decorations?: Record<string, ShaderTexturePositions>;
        positions?: ShaderTexturePositions;
    }

    let biomeTexturePositions: Record<string, ShaderTexturePositions> = {};
    let biomeDecorationsTexturePositions: Record<
        string,
        ShaderTexturePositions
    > = {};

    let entityGridSprites: Record<string, GridSprite> = {};
    let worldGridSprites: Record<string, GridSprite> = {};
    let pivotTarget: { x: number; y: number } = { x: 0, y: 0 };
    const shaderTexturesInWorld = new Set();

    // Caches
    const biomeCache = new LRUMemoryCache({ max: 1000 });
    const biomeDecorationsCache = new LRUMemoryCache({ max: 1000 });

    $: playerCell = $player && geohashToGridCell($player.location[0]);
    $: updatePlayer(playerCell);
    $: updateBiomes(playerCell);
    $: updateWorlds($worldRecord, playerCell);
    $: updateCreatures($monsterRecord, playerCell);
    $: updateCreatures($playerRecord, playerCell);
    $: updateItems($itemRecord, playerCell);
    $: resize(clientHeight, clientWidth);

    /*
     * Utility functions
     */

    function updatePivot(tween = true) {
        if (playerSprite && worldStage) {
            const offsetX = Math.floor(
                playerSprite.x + CELL_WIDTH / 2 - clientWidth / 2,
            );
            const offsetY = playerSprite.y - Math.floor(clientHeight / 2);
            if (tween) {
                pivotTarget = { x: offsetX, y: offsetY };
            } else {
                worldStage.pivot = { x: offsetX, y: offsetY };
            }
        }
    }

    function isCellInView(
        cell: { row: number; col: number }, // no need precision
        playerCell: GridCell,
    ): boolean {
        return (
            cell.row <= playerCell.row + GRID_MID_ROW &&
            cell.row >= playerCell.row - GRID_MID_ROW &&
            cell.col <= playerCell.col + GRID_MID_COL &&
            cell.col >= playerCell.col - GRID_MID_COL
        );
    }

    function resize(clientHeight: number, clientWidth: number) {
        if (app && isInitialized && clientHeight && clientWidth) {
            app.renderer.resize(clientWidth, clientHeight);
            updatePivot();
        }
    }

    async function loadAssetTexture(
        asset: AssetMetadata,
        { variant, seed }: { variant?: string; seed?: number } = {},
    ): Promise<Texture | null> {
        seed ??= 0;

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
        const [bundleName, alias] = asset.path.split("/").slice(-2);
        const bundle = await Assets.loadBundle(bundleName);

        // Bundle might be a sprite sheet or image
        const frame =
            bundle[alias]?.textures?.[asset.variants?.[variant] || "default"] ||
            bundle[alias];
        return frame || null;
    }

    async function loadWorld({
        world,
        origin,
        town,
    }: {
        world: World;
        town: string;
        origin: GridCell;
    }) {
        if (!isInitialized || worldStage == null) {
            return;
        }

        const tilemap = await Assets.load(world.url);
        const { layers, tilesets, tileheight, tilewidth } = tilemap;
        const tileset = await Assets.load(tilesets[0].source);

        // Convert cartesian to isometric position
        const [originX, originY] = cartToIso(
            origin.col * CELL_WIDTH,
            origin.row * CELL_HEIGHT,
        );

        const [tileOffsetX, tileOffsetY] = cartToIso(
            tilewidth / 2,
            tilewidth / 2,
        );

        // /////////////// TEST ADD COLLDIERS (DOES NOT MATCH UP WITH RENDERED TILEMAP)
        // TODO: add this as a helper function to draw colliders in map

        // const pedestalBundle = await Assets.loadBundle("pedestals");
        // const pedestalTexture =
        //     pedestalBundle["pedestals"].textures["square_dirt_high"];

        // // Create ORIGIN sprite
        // const sprite = new Sprite(pedestalTexture);
        // sprite.width = CELL_WIDTH;
        // sprite.height =
        //     (pedestalTexture.height * sprite.width) / pedestalTexture.width;
        // sprite.anchor.set(0.5); // TODO: set in sprite.json

        // // Convert cartesian to isometric position
        // const [isoX, isoY] = cartToIso(
        //     origin.col * CELL_WIDTH,
        //     origin.row * CELL_HEIGHT,
        // );
        // sprite.x = isoX;
        // sprite.y = isoY - CELL_HEIGHT / 4; // isometric cell height is half of cartesian cell height
        // sprite.zIndex = Z_LAYERS.humanoid + isoY + 1000000000000;
        // worldStage.addChild(sprite);

        // for (const cld of world.cld) {
        //     const { row, col } = geohashToGridCell(cld);

        //     const pedestalBundle = await Assets.loadBundle("pedestals");
        //     const pedestalTexture =
        //         pedestalBundle["pedestals"].textures["square_dirt_high"];

        //     // Create sprite
        //     const sprite = new Sprite(pedestalTexture);
        //     sprite.width = CELL_WIDTH;
        //     sprite.height =
        //         (pedestalTexture.height * sprite.width) / pedestalTexture.width;
        //     sprite.anchor.set(0.5); // TODO: set in sprite.json

        //     // Convert cartesian to isometric position
        //     const [isoX, isoY] = cartToIso(col * CELL_WIDTH, row * CELL_HEIGHT);
        //     sprite.x = isoX;
        //     sprite.y = isoY - CELL_HEIGHT / 4; // isometric cell height is half of cartesian cell height
        //     sprite.zIndex = Z_LAYERS.humanoid + isoY + 1000000000000;
        //     worldStage.addChild(sprite);
        // }
        // ////////////////////

        for (const layer of layers) {
            const {
                data, // 1D array of tile indices
                properties,
                offsetx, // in pixels
                offsety,
                width, // in tiles
                height,
                x,
                y,
            } = layer;

            // Get properties
            const { z, collider, interior } = (
                properties as { name: string; value: any; type: string }[]
            ).reduce((acc: Record<string, any>, { name, value, type }) => {
                acc[name] = value;
                return acc;
            }, {});

            // Create tile sprites
            for (let i = 0; i < height; i++) {
                for (let j = 0; j < width; j++) {
                    const tileId = data[i * width + j];
                    if (tileId === 0) {
                        continue;
                    }
                    const id = `${town}-${world.world}-${tileId}-${i}-${j}`;

                    // Skip if already created
                    if (id in worldGridSprites) {
                        continue;
                    }

                    const { image, imageheight, imagewidth } =
                        tileset.tiles[tileId - 1];
                    const texture = await Assets.load(image);
                    const sprite = new Sprite(texture);
                    const [isoX, isoY] = cartToIso(
                        j * imagewidth,
                        i * imagewidth, // Note: imagewidth for cartesian
                    );
                    sprite.x = isoX + (offsetx || 0) + originX + tileOffsetX;
                    sprite.y = isoY + (offsety || 0) + originY + tileOffsetY;
                    sprite.zIndex = (Z_LAYERS[z] ?? Z_LAYERS.ground) + sprite.y;

                    // The anchor point is the bottom center of the sprite
                    sprite.anchor.set(0.5, 1 - tileheight / imageheight / 2);

                    // Remove old sprite
                    if (
                        id in worldGridSprites &&
                        worldGridSprites[id].sprite != null
                    ) {
                        worldStage.removeChild(worldGridSprites[id].sprite);
                        worldGridSprites[id].sprite.destroy();
                    }

                    // Add sprite to worldGridSprites (Note: must start with town, as it is used for culling)
                    worldGridSprites[id] = {
                        id,
                        sprite: worldStage.addChild(sprite),
                        x: sprite.x,
                        y: sprite.y,
                        row: origin.row + i,
                        col: origin.col + j,
                    };
                }
            }
        }
    }

    function createCreatureSprite(
        texture: Texture,
        pedestalTexture: Texture,
    ): Sprite {
        const sprite = new Sprite(texture);
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

    /*
     * Render functions
     */

    async function updatePlayer(playerCell: GridCell | null) {
        if (!isInitialized || playerCell == null || worldStage == null) {
            return;
        }

        // Cull sprites outside view
        for (const [id, s] of Object.entries(entityGridSprites)) {
            if (!isCellInView(s, playerCell)) {
                worldStage.removeChild(entityGridSprites[id].sprite);
                entityGridSprites[id].sprite.destroy();
                delete entityGridSprites[id];
            }
        }

        // Cull world sprites outside town
        const town = playerCell.geohash.slice(
            0,
            worldSeed.spatial.town.precision,
        );
        for (const [id, entity] of Object.entries(worldGridSprites)) {
            if (!id.startsWith(town)) {
                worldStage.removeChild(worldGridSprites[id].sprite);
                worldGridSprites[id].sprite.destroy();
                delete worldGridSprites[id];
            }
        }

        // Player
        if (playerSprite != null) {
            const [isoX, isoY] = cartToIso(
                playerCell.col * CELL_HEIGHT,
                playerCell.row * CELL_WIDTH,
            );

            const height = await heightAtGeohash(playerCell.geohash, {
                responseCache: topologyResponseCache,
                resultsCache: topologyResultCache,
                bufferCache: topologyBufferCache,
            });
            const topologicalHeight = TOPOLOGICAL_HEIGHT_SCALE * height;

            playerSprite.x = isoX;
            playerSprite.y = isoY - topologicalHeight - CELL_HEIGHT / 4; // isometric cell height is half of cartesian cell height
            playerSprite.zIndex = Z_LAYERS.player + isoY - CELL_HEIGHT / 4;
        }

        // Move camera to player
        updatePivot();
    }

    async function updateWorlds(
        worldRecord: Record<string, Record<string, World>>,
        playerCell: GridCell | null,
    ) {
        if (!isInitialized || playerCell == null) {
            return;
        }

        // Get all worlds in town
        const town = playerCell.geohash.slice(
            0,
            worldSeed.spatial.town.precision,
        );
        const worlds = worldRecord[town];
        if (!worlds) {
            return;
        }

        // Load worlds
        for (const w of Object.values(worlds)) {
            const origin = autoCorrectGeohashPrecision(
                w.loc[0],
                worldSeed.spatial.unit.precision,
            );
            await loadWorld({
                world: w,
                origin: geohashToGridCell(origin),
                town,
            });
        }
    }

    async function drawShaderTextures({
        shaderName,
        shaderTextures,
        layer,
        numGeometries,
    }: {
        shaderName: string;
        shaderTextures: Record<string, ShaderTexturePositions>;
        layer: number;
        numGeometries: number;
    }) {
        if (!isInitialized || worldStage == null) {
            return;
        }

        for (const [
            textureUid,
            { texture, positions, width, height },
        ] of Object.entries(shaderTextures)) {
            const [shader, { geometry, instancePositions, mesh }] =
                loadShaderGeometry(
                    shaderName,
                    texture,
                    width,
                    height,
                    numGeometries,
                );

            // Update instance positions buffer
            if (instancePositions) {
                instancePositions.data.set(positions);
                instancePositions.update();
            }

            // Add mesh with instanced geometry to world
            if (mesh && !shaderTexturesInWorld.has(textureUid)) {
                mesh.zIndex = layer + playerSprite.y;
                worldStage.addChild(mesh);
                shaderTexturesInWorld.add(textureUid);
            }
        }
    }

    async function calculateBiomeForRowCol(
        playerCell: GridCell,
        row: number,
        col: number,
    ): Promise<{
        texture: Texture;
        isoX: number;
        isoY: number;
        topologicalHeight: number;
        biome: string;
        geohash: string;
        strength: number;
        width: number;
        height: number;
    }> {
        const geohash = gridCellToGeohash({
            precision: playerCell.precision,
            row,
            col,
        });

        // Get biome properties and asset
        const [biome, strength] = await biomeAtGeohash(geohash, {
            topologyResponseCache,
            topologyResultCache,
            topologyBufferCache,
        });
        const topologicalHeight =
            TOPOLOGICAL_HEIGHT_SCALE *
            (await heightAtGeohash(geohash, {
                responseCache: topologyResponseCache,
                resultsCache: topologyResultCache,
                bufferCache: topologyBufferCache,
            }));

        const asset = biomes[biome].asset;
        if (!asset) {
            throw new Error(`Missing asset for ${biome}`);
        }

        // Load texture
        const texture = await loadAssetTexture(asset, {
            seed: (row << 8) + col, // bit shift by 8 else gridRow + gridCol is the same at diagonals
        });
        if (!texture) {
            throw new Error(`Missing texture for ${biome}`);
        }

        // Scale the width and height of the texture to the cell while maintaining aspect ratio
        const width = CELL_WIDTH;
        const height = (texture.height * width) / texture.width;

        // Convert cartesian to isometric position
        const [isoX, isoY] = cartToIso(col * CELL_WIDTH, row * CELL_HEIGHT);

        return {
            geohash,
            biome,
            strength,
            texture,
            isoX,
            isoY,
            topologicalHeight,
            width,
            height,
        };
    }

    async function calculateBiomeDecorationsForRowCol({
        geohash,
        biome,
        strength,
        row,
        col,
        isoX,
        isoY,
        topologicalHeight,
    }: {
        geohash: string;
        biome: string;
        strength: number;
        row: number;
        col: number;
        isoX: number;
        isoY: number;
        topologicalHeight: number;
    }): Promise<Record<string, ShaderTexturePositions>> {
        const texturePositions: Record<string, ShaderTexturePositions> = {};

        // TODO: Skip decorations in world

        // Get biome decorations
        const decorations = biomes[biome].decorations;
        if (!decorations) {
            return texturePositions;
        }
        const geohashSeed = stringToRandomNumber(geohash);

        for (const [
            name,
            { asset, probability, minInstances, maxInstances, radius },
        ] of Object.entries(decorations)) {
            // Determine if this geohash should have decorations
            const dice = seededRandom(geohashSeed);
            if (dice > probability) {
                continue;
            }

            // Number of instances depends on the strength of the tile
            let numInstances = Math.ceil(
                minInstances + strength * (maxInstances - minInstances),
            );

            // Get evenly spaced offsets
            const spacedOffsets = generateEvenlySpacedPoints(
                numInstances,
                CELL_WIDTH * radius,
            );

            for (let i = 0; i < numInstances; i++) {
                const instanceSeed = seededRandom((row << 8) + col + i);
                const instanceRv = seededRandom(instanceSeed);

                // Load texture
                const texture = await loadAssetTexture(asset, {
                    seed: instanceSeed,
                });
                if (!texture) {
                    console.error(`Missing texture for ${name}`);
                    continue;
                }

                // Initialize decorations
                if (texturePositions[texture.uid] == null) {
                    texturePositions[texture.uid] = {
                        texture,
                        positions: new Float32Array(
                            MAX_SHADER_GEOMETRIES * 3,
                        ).fill(-1), // x, y, z
                        height: texture.height,
                        width: texture.width,
                        length: 0,
                    };
                }

                // Evenly space out decorations and add jitter
                const jitter = ((instanceRv - 0.5) * CELL_WIDTH) / 2;
                const x = spacedOffsets[i].x + isoX + jitter;
                const y =
                    spacedOffsets[i].y + isoY + jitter - topologicalHeight;

                // Add to decoration positions
                texturePositions[texture.uid].positions[
                    texturePositions[texture.uid].length
                ] = x;
                texturePositions[texture.uid].positions[
                    texturePositions[texture.uid].length + 1
                ] = y;
                // TODO: this is a problem because it is cached while the player moves
                texturePositions[texture.uid].positions[
                    texturePositions[texture.uid].length + 2
                ] = (isoY + Z_LAYERS.hip - playerSprite.y) * Z_SCALE;

                texturePositions[texture.uid].length += 3;
            }
        }
        return texturePositions;
    }

    const memoizedCalculateBiomeForRowCol = memoize(
        calculateBiomeForRowCol,
        biomeCache,
        (playerCell, row, col) => `${row}-${col}`,
    );

    const memoizedCalculateBiomeDecorationsForRowCol = memoize(
        calculateBiomeDecorationsForRowCol,
        biomeDecorationsCache,
        ({ row, col }) => `${row}-${col}`,
    );

    async function updateBiomes(playerCell: GridCell | null) {
        if (!isInitialized || playerCell == null) {
            return;
        }

        // Clear shader textures
        biomeTexturePositions = {};
        biomeDecorationsTexturePositions = {};

        // Create biome sprites
        for (
            let row = playerCell.row - GRID_MID_ROW;
            row < playerCell.row + GRID_MID_ROW;
            row++
        ) {
            for (
                let col = playerCell.col - GRID_MID_COL;
                col < playerCell.col + GRID_MID_COL;
                col++
            ) {
                // Fill biomeTexturePositions
                const {
                    isoX,
                    isoY,
                    texture,
                    topologicalHeight,
                    biome,
                    geohash,
                    strength,
                    width,
                    height,
                } = await memoizedCalculateBiomeForRowCol(playerCell, row, col);

                if (biomeTexturePositions[texture.uid] == null) {
                    biomeTexturePositions[texture.uid] = {
                        texture,
                        positions: new Float32Array(
                            MAX_SHADER_GEOMETRIES * 3,
                        ).fill(-1), // x, y, z
                        width,
                        height,
                        length: 0,
                    };
                } else {
                    biomeTexturePositions[texture.uid].positions[
                        biomeTexturePositions[texture.uid].length
                    ] = isoX;
                    biomeTexturePositions[texture.uid].positions[
                        biomeTexturePositions[texture.uid].length + 1
                    ] = isoY - topologicalHeight;
                    biomeTexturePositions[texture.uid].positions[
                        biomeTexturePositions[texture.uid].length + 2
                    ] = (isoY + Z_LAYERS.biome - playerSprite.y) * Z_SCALE;
                    biomeTexturePositions[texture.uid].length += 3;
                }

                // Fill biomeDecorationsTexturePositions
                for (const [
                    textureUid,
                    { positions, texture, height, width, length },
                ] of Object.entries(
                    await memoizedCalculateBiomeDecorationsForRowCol({
                        geohash,
                        biome,
                        strength,
                        row,
                        col,
                        isoX,
                        isoY,
                        topologicalHeight,
                    }),
                )) {
                    if (biomeDecorationsTexturePositions[textureUid] == null) {
                        biomeDecorationsTexturePositions[textureUid] = {
                            texture,
                            positions: new Float32Array(
                                MAX_SHADER_GEOMETRIES * 3,
                            ).fill(-1), // x, y, z
                            width,
                            height,
                            length: 0,
                        };
                    } else {
                        biomeDecorationsTexturePositions[
                            textureUid
                        ].positions.set(
                            positions.subarray(0, length),
                            biomeDecorationsTexturePositions[textureUid].length,
                        );
                        biomeDecorationsTexturePositions[textureUid].length +=
                            length;
                    }
                }
            }
        }
        // Draw shaders
        drawShaderTextures({
            shaderName: "biome",
            shaderTextures: biomeTexturePositions,
            layer: Z_LAYERS.biome,
            numGeometries: MAX_SHADER_GEOMETRIES,
        });
        drawShaderTextures({
            shaderName: "grass",
            shaderTextures: biomeDecorationsTexturePositions,
            layer: Z_LAYERS.hip,
            numGeometries: MAX_SHADER_GEOMETRIES,
        });
    }

    async function updateItems(
        ir: Record<string, Item>,
        playerCell: GridCell | null,
    ) {
        if (!isInitialized || playerCell == null || worldStage == null) {
            return;
        }

        for (const item of Object.values(ir)) {
            const cell = geohashToGridCell(item.location[0]);
            const { row, col } = cell;

            // Ignore entities outside player's view
            if (!isCellInView(cell, playerCell)) {
                continue;
            }

            // Get asset
            const prop = compendium[item.prop];
            const variant = prop.states[item.state].variant;
            const asset = prop?.asset;
            const { width } = asset;

            // Update
            if (item.item in entityGridSprites) {
                const { sprite, variant: oldVariant } =
                    entityGridSprites[item.item];

                // Check variant changed (when item.state changes)
                if (oldVariant !== variant) {
                    const texture = await loadAssetTexture(prop.asset, {
                        variant,
                    });
                    if (!texture) {
                        console.error(`Missing texture for ${item.name}`);
                        continue;
                    }
                    (sprite as Sprite).texture = texture;
                    entityGridSprites[item.item].variant = variant;
                }

                const [isoX, isoY] = cartToIso(
                    col * CELL_HEIGHT,
                    row * CELL_WIDTH,
                );
                sprite.x = isoX;
                sprite.y = isoY - CELL_HEIGHT / 4; // TODO: Remove and use anchor - isometric cell height is half of cartesian cell height
                sprite.zIndex = Z_LAYERS.item + sprite.y;
            }
            // Create
            else {
                // Load texture
                const texture = await loadAssetTexture(asset, { variant });
                if (!texture) {
                    console.error(`Missing texture for ${item.name}`);
                    continue;
                }

                // Create sprite
                const sprite = new Sprite(texture);
                sprite.anchor.set(0.5); // TODO: set anchor in sprite.json not here as each asset is different
                sprite.width = CELL_WIDTH * width; // Note: Item is scaled to asset.width
                sprite.height = (texture.height * sprite.width) / texture.width; // maintain aspect ratio

                // Convert cartesian to isometric position
                const [isoX, isoY] = cartToIso(
                    col * CELL_WIDTH,
                    row * CELL_HEIGHT,
                );
                sprite.x = isoX;
                sprite.y = isoY - CELL_HEIGHT / 4; //TODO: Remove and use anchor -  isometric cell height is half of cartesian cell height
                sprite.zIndex = Z_LAYERS.item + sprite.y;

                // Remove old sprite
                if (
                    item.item in entityGridSprites &&
                    entityGridSprites[item.item].sprite != null
                ) {
                    worldStage.removeChild(entityGridSprites[item.item].sprite);
                    entityGridSprites[item.item].sprite.destroy();
                }

                // Add to entityGridSprites
                entityGridSprites[item.item] = {
                    id: item.item,
                    sprite: worldStage.addChild(sprite),
                    x: sprite.x,
                    y: sprite.y,
                    row,
                    col,
                    variant,
                };
            }
        }
    }

    async function updateCreatures(
        er: Record<string, Monster | Player>,
        playerCell: GridCell | null,
    ) {
        if (!isInitialized || playerCell == null || worldStage == null) {
            return;
        }

        for (const entity of Object.values(er)) {
            const cell = geohashToGridCell(entity.location[0]);
            const { row, col } = cell;
            const [id, entityType] = entityId(entity);

            // Ignore entities outside player's view
            if (!isCellInView(cell, playerCell)) {
                continue;
            }

            // Update
            if (id in entityGridSprites) {
                const sprite = entityGridSprites[id].sprite;
                const [isoX, isoY] = cartToIso(
                    col * CELL_HEIGHT,
                    row * CELL_WIDTH,
                );
                sprite.x = isoX;
                sprite.y = isoY - CELL_HEIGHT / 4; // isometric cell height is half of cartesian cell height
                sprite.zIndex = Z_LAYERS.monster + sprite.y;
            }
            // Create
            else {
                // Load texture
                let texture: Texture | null = null;
                if (entityType === "monster") {
                    const asset = bestiary[(entity as Monster).beast]?.asset;
                    texture = await loadAssetTexture(asset);
                } else if (entityType === "player") {
                    // TODO: load actual player avatar
                    texture = await Assets.load(playerAvatar);
                }

                if (texture == null) {
                    console.error(`Missing texture for ${entity.name}`);
                    continue;
                }

                // Load pedestal texture
                const pedestalBundle = await Assets.loadBundle("pedestals");
                const pedestalTexture =
                    pedestalBundle["pedestals"].textures["square_dirt_high"];

                // Create sprite
                const sprite = createCreatureSprite(texture, pedestalTexture);
                if (!sprite) {
                    console.error(`Failed to create sprite for ${entity.name}`);
                    continue;
                }

                // Convert cartesian to isometric position
                const [isoX, isoY] = cartToIso(
                    col * CELL_WIDTH,
                    row * CELL_HEIGHT,
                );
                sprite.x = isoX;
                sprite.y = isoY - CELL_HEIGHT / 4; // isometric cell height is half of cartesian cell height
                sprite.zIndex = Z_LAYERS[entityType] + sprite.y;

                // Remove old sprite
                if (
                    id in entityGridSprites &&
                    entityGridSprites[id].sprite != null
                ) {
                    worldStage.removeChild(entityGridSprites[id].sprite);
                    entityGridSprites[id].sprite.destroy();
                }

                // Add to entityGridSprites
                entityGridSprites[id] = {
                    id: id,
                    sprite: worldStage.addChild(sprite),
                    x: sprite.x,
                    y: sprite.y,
                    row,
                    col,
                };
            }
        }
    }

    function ticker(ticker: Ticker) {
        if (!isInitialized || app == null || worldStage == null) {
            return;
        }

        // Clear depth buffer
        const gl = (app.renderer as WebGLRenderer).gl;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Update shader uniforms
        const seconds = ticker.elapsedMS / 1000;
        updateShaderUniforms({ deltaTime: seconds });

        // Move camera to target position (prevent jitter at the end)
        const deltaX = pivotTarget.x - worldStage.pivot.x;
        worldStage.pivot.x = Math.round(worldStage.pivot.x + deltaX * seconds);
        const deltaY = pivotTarget.y - worldStage.pivot.y;
        worldStage.pivot.y = Math.round(worldStage.pivot.y + deltaY * seconds);
    }

    /*
     * Initialization
     */

    async function initAssetManager() {
        // Check if already initialized
        if (isInitialized) return;

        // Load assets in background
        await Assets.init({ manifest: "/sprites/manifest.json" });
        Assets.backgroundLoadBundle([
            "player",
            "biomes",
            "bestiary",
            "props",
            "pedestals",
        ]);
    }

    async function init() {
        if (isInitialized || app == null || worldStage == null) {
            return;
        }

        await app.init({
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            antialias: false,
            preference: "webgl",
        });
        await initAssetManager();

        // Set up depth test
        const gl = (app.renderer as WebGLRenderer).gl;
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.depthMask(true);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Add world container
        worldStage.width = WORLD_WIDTH;
        worldStage.height = WORLD_HEIGHT;
        app.stage.addChild(worldStage);

        // Player sprite
        playerTexture = await Assets.load(playerAvatar);
        const pedestalBundle = await Assets.loadBundle("pedestals");
        const pedestalTexture =
            pedestalBundle["pedestals"].textures["square_dirt_high"];
        playerSprite = createCreatureSprite(playerTexture, pedestalTexture);
        worldStage.addChild(playerSprite);

        // Add ticker
        app.ticker.add(ticker);

        // Add the canvas to the DOM
        container.appendChild(app.canvas);

        // Set initialized
        isInitialized = true;

        // Resize the canvas
        resize(clientHeight, clientWidth);

        // Initial update
        if (playerCell) {
            await updatePlayer(playerCell);
            await updateBiomes(playerCell);
            await updateCreatures($monsterRecord, playerCell);
            await updateCreatures($playerRecord, playerCell);
            await updateItems($itemRecord, playerCell);
            await updateWorlds($worldRecord, playerCell);
            updatePivot(false);
        }
    }

    onMount(() => {
        app = new Application();
        worldStage = new Container();

        init();

        return () => {
            if (app != null) {
                // app?.destroy(false, { children: true, texture: true });
            }
        };
    });
</script>

{#if playerCell}
    <div
        class={cn("w-full h-full p-0 m-0", $$restProps.class)}
        bind:this={container}
        bind:clientHeight
        bind:clientWidth
    ></div>
{/if}

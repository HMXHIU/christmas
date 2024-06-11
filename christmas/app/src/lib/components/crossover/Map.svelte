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
        Buffer,
        Container,
        Geometry,
        Mesh,
        Shader,
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

    // Note: this are cartesian coordinates (CELL_HEIGHT = CELL_WIDTH;)
    const CELL_WIDTH = 64;
    const CELL_HEIGHT = CELL_WIDTH;
    const ISO_CELL_HEIGHT = CELL_HEIGHT / 2;
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

    // Depth test scaling and offsets
    const { row: brRow, col: brCol } = geohashToGridCell("pbzupuzv");
    const isoBrY = cartToIso(brCol * CELL_WIDTH, brRow * CELL_HEIGHT)[1];
    const Z_SCALE = -1 / isoBrY;
    const Z_ATOM = ISO_CELL_HEIGHT / 2;
    const Z_OFF: Record<string, number> = {
        ground: 0,
        biome: 0,
        grass: 0,
        floor: 3 * Z_ATOM,
        wall: 4 * Z_ATOM,
        item: 4 * Z_ATOM,
        monster: 4 * Z_ATOM,
        player: 4 * Z_ATOM,
        l2: 8 * Z_ATOM,
        l3: 12 * Z_ATOM,
    };

    // This is different from depth testing (but used to control when which objects are drawn for alpha blending)
    const RENDER_ORDER: Record<string, number> = {
        ground: 0,
        biome: 0,
        floor: 0,
        wall: 0,
        item: 0,
        monster: 0,
        player: 0,
        world: 0,
        grass: 1, // draw last because it has alpha
    };

    // In WebGL, the gl_Position.z value should be in the range [-1 (closer), 1]
    const TOPO_SCALE = CELL_HEIGHT / 2 / 8; // 1 meter = 1/8 a cell height (on isometric coordinates)

    interface Position {
        row: number;
        col: number;
        isoX: number;
        isoY: number;
        geohash: string;
        precision: number;
        topologicalHeight: number;
    }

    interface ShaderTexture {
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
        decorations?: Record<string, ShaderTexture>;
        positions?: ShaderTexture;
    }

    interface EntityMesh {
        id: string;
        mesh: Mesh<Geometry, Shader>;
        instancePositions: Buffer;
        properties?: {
            variant?: string;
        };
    }

    let container: HTMLDivElement;
    let isInitialized = false;
    let clientWidth: number;
    let clientHeight: number;
    let app: Application | null = null;
    let worldStage: Container | null = null;

    let biomeTexturePositions: Record<string, ShaderTexture> = {};
    let biomeDecorationsTexturePositions: Record<string, ShaderTexture> = {};

    let entityMeshes: Record<string, EntityMesh> = {};
    let worldMeshes: Record<string, EntityMesh> = {};

    let playerPosition: Position | null = null;

    // TODO: REMOVE
    let entityGridSprites: Record<string, GridSprite> = {};

    let worldGridSprites: Record<string, GridSprite> = {};
    let pivotTarget: { x: number; y: number } = { x: 0, y: 0 };
    const shaderTexturesInWorld = new Set();

    // Caches
    const biomeCache = new LRUMemoryCache({ max: 1000 });
    const biomeDecorationsCache = new LRUMemoryCache({ max: 1000 });

    $: updatePlayerPosition($player);
    $: updatePlayer(playerPosition);
    $: updateBiomes(playerPosition);
    $: updateWorlds($worldRecord, playerPosition);
    $: updateEntities($monsterRecord, playerPosition);
    $: updateEntities($playerRecord, playerPosition);
    $: updateEntities($itemRecord, playerPosition);
    $: resize(clientHeight, clientWidth);

    /*
     * Utility functions
     */

    function updatePlayerPosition(player: Player | null) {
        if (player == null) {
            return;
        }
        calculatePosition(player.location[0]).then((p) => {
            playerPosition = p;
        });
    }

    async function calculatePosition(
        geohash: string,
        options?: {
            cellWidth?: number;
            cellHeight?: number;
        },
    ): Promise<Position> {
        const width = options?.cellWidth ?? CELL_WIDTH;
        const height = options?.cellHeight ?? CELL_HEIGHT;
        const { row, col, precision } = geohashToGridCell(geohash);
        const [isoX, isoY] = cartToIso(col * width, row * height);
        const topologicalHeight =
            TOPO_SCALE *
            (await heightAtGeohash(geohash, {
                responseCache: topologyResponseCache,
                resultsCache: topologyResultCache,
                bufferCache: topologyBufferCache,
            }));
        return { row, col, isoX, isoY, geohash, precision, topologicalHeight };
    }

    function updateCamera(player: Player, tween = true) {
        const playerMesh = entityMeshes[player.player].mesh;
        if (playerMesh && worldStage) {
            const offsetX = Math.floor(
                playerMesh.x + CELL_WIDTH / 2 - clientWidth / 2,
            );
            const offsetY = playerMesh.y - Math.floor(clientHeight / 2);
            if (tween) {
                pivotTarget = { x: offsetX, y: offsetY };
            } else {
                worldStage.pivot = { x: offsetX, y: offsetY };
            }
        }
    }

    function isCellInView(
        cell: { row: number; col: number }, // no need precision
        playerPosition: Position,
    ): boolean {
        return (
            cell.row <= playerPosition.row + GRID_MID_ROW &&
            cell.row >= playerPosition.row - GRID_MID_ROW &&
            cell.col <= playerPosition.col + GRID_MID_COL &&
            cell.col >= playerPosition.col - GRID_MID_COL
        );
    }

    function resize(clientHeight: number, clientWidth: number) {
        if (app && isInitialized && clientHeight && clientWidth && $player) {
            app.renderer.resize(clientWidth, clientHeight);
            updateCamera($player);
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

    /*
     * Render functions
     */

    async function updatePlayer(playerPosition: Position | null) {
        if (
            !isInitialized ||
            playerPosition == null ||
            worldStage == null ||
            $player == null
        ) {
            return;
        }

        // TODO:: Cull sprites outside view
        for (const [id, s] of Object.entries(entityGridSprites)) {
            if (!isCellInView(s, playerPosition)) {
                worldStage.removeChild(entityGridSprites[id].sprite);
                entityGridSprites[id].sprite.destroy();
                delete entityGridSprites[id];
            }
        }

        // Cull world sprites outside town
        const town = playerPosition.geohash.slice(
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
        const playerMesh = entityMeshes[$player.player];
        if (playerMesh.mesh != null) {
            // Update position
            playerMesh.mesh.x = playerPosition.isoX;
            playerMesh.mesh.y =
                playerPosition.isoY - playerPosition.topologicalHeight;
            playerMesh.instancePositions.data.set([
                playerMesh.mesh.x,
                playerMesh.mesh.y,
                (playerPosition.isoY + Z_OFF.player) * Z_SCALE, // everything is relative to player
            ]);
            playerMesh.instancePositions.update();
        }

        // Move camera to player
        updateCamera($player);
    }

    async function updateWorlds(
        worldRecord: Record<string, Record<string, World>>,
        playerPosition: Position | null,
    ) {
        if (!isInitialized || playerPosition == null) {
            return;
        }

        // Get all worlds in town
        const town = playerPosition.geohash.slice(
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

            const position = await calculatePosition(origin);

            await loadWorld({
                world: w,
                position,
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
        shaderTextures: Record<string, ShaderTexture>;
        layer: number;
        numGeometries: number;
    }) {
        if (!isInitialized || worldStage == null || $player == null) {
            return;
        }

        for (const [
            textureUid,
            { texture, positions, width, height },
        ] of Object.entries(shaderTextures)) {
            const [shader, { geometry, instancePositions, mesh }] =
                loadShaderGeometry(shaderName, texture, width, height, {
                    instanceCount: numGeometries,
                    depthFactor: Z_SCALE,
                });

            // Update instance positions buffer
            if (instancePositions && positions != null) {
                instancePositions.data.set(positions);
                instancePositions.update();
            }

            // Add mesh with instanced geometry to world
            if (mesh && !shaderTexturesInWorld.has(textureUid)) {
                mesh.zIndex = layer;
                worldStage.addChild(mesh);
                shaderTexturesInWorld.add(textureUid);
            }
        }
    }

    async function calculateBiomeForRowCol(
        playerPosition: Position,
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
            precision: playerPosition.precision,
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
            TOPO_SCALE *
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
    }): Promise<Record<string, ShaderTexture>> {
        const texturePositions: Record<string, ShaderTexture> = {};

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
                texturePositions[texture.uid].positions![
                    texturePositions[texture.uid].length
                ] = x;
                texturePositions[texture.uid].positions![
                    texturePositions[texture.uid].length + 1
                ] = y;
                // Note: Don't set the z here is it cannot be cached (player moves)
                texturePositions[texture.uid].length += 3;
            }
        }
        return texturePositions;
    }

    const memoizedCalculateBiomeForRowCol = memoize(
        calculateBiomeForRowCol,
        biomeCache,
        (playerPosition, row, col) => `${row}-${col}`,
    );

    const memoizedCalculateBiomeDecorationsForRowCol = memoize(
        calculateBiomeDecorationsForRowCol,
        biomeDecorationsCache,
        ({ row, col }) => `${row}-${col}`,
    );

    async function updateBiomes(playerPosition: Position | null) {
        if (!isInitialized || playerPosition == null || $player == null) {
            return;
        }

        // Clear shader textures
        biomeTexturePositions = {};
        biomeDecorationsTexturePositions = {};

        // Create biome sprites
        for (
            let row = playerPosition.row - GRID_MID_ROW;
            row < playerPosition.row + GRID_MID_ROW;
            row++
        ) {
            for (
                let col = playerPosition.col - GRID_MID_COL;
                col < playerPosition.col + GRID_MID_COL;
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
                } = await memoizedCalculateBiomeForRowCol(
                    playerPosition,
                    row,
                    col,
                );

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
                    biomeTexturePositions[texture.uid].positions![
                        biomeTexturePositions[texture.uid].length
                    ] = isoX;
                    biomeTexturePositions[texture.uid].positions![
                        biomeTexturePositions[texture.uid].length + 1
                    ] = isoY - topologicalHeight;
                    biomeTexturePositions[texture.uid].positions![
                        biomeTexturePositions[texture.uid].length + 2
                    ] = (isoY + Z_OFF.biome) * Z_SCALE;
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
                        // Fill in z values for positions
                        for (let i = 0; i < length; i += 3) {
                            positions![i + 2] =
                                (positions![i + 1] +
                                    topologicalHeight +
                                    Z_OFF.grass) *
                                Z_SCALE;
                        }
                        biomeDecorationsTexturePositions[
                            textureUid
                        ].positions!.set(
                            positions!.subarray(0, length),
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
            layer: RENDER_ORDER.biome,
            numGeometries: MAX_SHADER_GEOMETRIES,
        });
        drawShaderTextures({
            shaderName: "grass",
            shaderTextures: biomeDecorationsTexturePositions,
            layer: RENDER_ORDER.grass,
            numGeometries: MAX_SHADER_GEOMETRIES,
        });
    }

    async function loadWorld({
        world,
        position,
        town,
    }: {
        world: World;
        town: string;
        position: Position;
    }) {
        if (!isInitialized || worldStage == null) {
            return;
        }

        const tilemap = await Assets.load(world.url);
        const { layers, tilesets, tileheight, tilewidth } = tilemap;
        const tileset = await Assets.load(tilesets[0].source);

        // // Convert cartesian to isometric position
        // const [originX, originY] = cartToIso(
        //     origin.col * CELL_WIDTH,
        //     origin.row * CELL_HEIGHT,
        // );

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
        // sprite.zIndex = RENDER_ORDER.humanoid + isoY + 1000000000000;
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
        //     sprite.zIndex = RENDER_ORDER.humanoid + isoY + 1000000000000;
        //     worldStage.addChild(sprite);
        // }
        // ////////////////////

        for (const layer of layers) {
            const {
                data, // 1D array of tile indices
                properties,
                offsetx, // in pixels
                offsety,
                width, // in tiles (1 tile might be multiple cells)
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

                    // // Skip if already created
                    // if (id in worldGridSprites) {
                    //     continue;
                    // }

                    const { image, imageheight, imagewidth } =
                        tileset.tiles[tileId - 1];
                    const texture = await Assets.load(image);

                    const [isoX, isoY] = cartToIso(
                        j * imagewidth,
                        i * imagewidth, // Note: imagewidth for cartesian
                    );

                    // The anchor point is the center of the bottom tile (imageheight a multiple of tileheight)
                    const anchor = {
                        x: 0.5,
                        y: 1 - tileheight / imageheight / 2,
                    };

                    const [shader, { mesh, instancePositions }] =
                        loadShaderGeometry(
                            "world",
                            texture,
                            imagewidth,
                            imageheight,
                            {
                                uid: id,
                                anchor,
                                depthFactor: Z_SCALE,
                            },
                        );

                    // Set initial position
                    const x =
                        isoX + (offsetx ?? 0) + position.isoX + tileOffsetX;
                    const y =
                        isoY + (offsety ?? 0) + position.isoY + tileOffsetY;
                    const zOff = Z_OFF[z] ?? Z_OFF.floor;

                    mesh.x = x;
                    mesh.y = y - position.topologicalHeight;
                    mesh.zIndex = RENDER_ORDER[z] ?? RENDER_ORDER.floor;
                    instancePositions.data.set([
                        mesh.x,
                        mesh.y,
                        // The anchor is not at [0.5, 1] so we need to adjust the closest point to the camera
                        (y + tileheight / 2 + zOff) * Z_SCALE,
                    ]);
                    instancePositions.update();

                    // Add to worldMeshes
                    const worldMesh = {
                        id,
                        mesh,
                        instancePositions,
                    };

                    worldMeshes[id] = worldMesh;
                    worldStage.removeChild(mesh);
                    worldStage.addChild(mesh);

                    // const sprite = new Sprite(texture);
                    // sprite.x = isoX + (offsetx || 0) + originX + tileOffsetX;
                    // sprite.y = isoY + (offsety || 0) + originY + tileOffsetY;
                    // sprite.zIndex =
                    //     (RENDER_ORDER[z] ?? RENDER_ORDER.ground) + sprite.y;

                    // // The anchor point is the bottom center of the sprite
                    // sprite.anchor.set(0.5, 1 - tileheight / imageheight / 2);

                    // // Remove old sprite
                    // if (
                    //     id in worldGridSprites &&
                    //     worldGridSprites[id].sprite != null
                    // ) {
                    //     worldStage.removeChild(worldGridSprites[id].sprite);
                    //     worldGridSprites[id].sprite.destroy();
                    // }

                    // // Add sprite to worldGridSprites (Note: must start with town, as it is used for culling)
                    // worldGridSprites[id] = {
                    //     id,
                    //     sprite: worldStage.addChild(sprite),
                    //     x: sprite.x,
                    //     y: sprite.y,
                    //     row: origin.row + i,
                    //     col: origin.col + j,
                    // };
                }
            }
        }
    }

    async function upsertEntityMesh(entity: Player | Item | Monster) {
        if (worldStage == null || playerPosition == null || $player == null) {
            return;
        }

        const [entityUid, entityType] = entityId(entity);

        // Get position
        const { row, col, isoX, isoY, topologicalHeight } =
            await calculatePosition(entity.location[0]);

        // Ignore entities outside player's view
        if (!isCellInView({ row, col }, playerPosition)) {
            return;
        }

        // Update
        let entityMesh = entityMeshes[entityUid];
        if (entityMesh != null) {
            if (entityType === "player") {
            } else if (entityType === "monster") {
            } else if (entityType === "item") {
                const item = entity as Item;
                const prop = compendium[item.prop];
                const variant = prop.states[item.state].variant;

                // Check variant changed (when item.state changes)
                if (entityMesh.properties!.variant !== variant) {
                    const texture = await loadAssetTexture(prop.asset, {
                        variant,
                    });
                    if (!texture) {
                        console.log(`Missing texture for ${item.name}`);
                        return;
                    }
                    // Update texture
                    entityMesh.mesh.shader.resources.uTexture = texture.source;
                    // Update uvs
                    const { x0, y0, x1, y1, x2, y2, x3, y3 } = texture.uvs;
                    const uvBuffer = entityMesh.mesh.geometry.getBuffer("aUV");
                    uvBuffer.data.set([x0, y0, x1, y1, x2, y2, x3, y3]);
                    uvBuffer.update();
                    entityMesh.properties!.variant = variant;
                }

                // Set position
                entityMesh.mesh.x = isoX;
                entityMesh.mesh.y = isoY - topologicalHeight;
                entityMesh.instancePositions.data.set([
                    entityMesh.mesh.x,
                    entityMesh.mesh.y,
                    (isoY + Z_OFF[entityType]) * Z_SCALE,
                ]);
                entityMesh.instancePositions.update();
            }

            // Add again as it might have been removed during culling
            worldStage.removeChild(entityMesh.mesh);
            worldStage.addChild(entityMesh.mesh);
        }
        // Create
        else {
            let texture: Texture | null = null;
            let width: number = 0;
            let anchor: { x: number; y: number } = { x: 0.5, y: 0.5 };
            let variant: string | null = null;

            // Get texture, variant, width, anchor
            if (entityType === "player") {
                texture = await Assets.load((entity as Player).avatar);
                width = CELL_WIDTH;
                anchor = { x: 0.5, y: 1 };
            } else if (entityType === "monster") {
                const monster = entity as Monster;
                const asset = bestiary[monster.beast]?.asset;
                texture = await loadAssetTexture(asset);
                width = asset.width * CELL_WIDTH; // asset.width is the multiplier
                anchor = { x: 0.5, y: 1 };
            } else if (entityType === "item") {
                const item = entity as Item;
                const prop = compendium[item.prop];
                const asset = prop?.asset;
                variant = prop.states[item.state].variant;
                width = asset.width * CELL_WIDTH; // asset.width is the multiplier
                texture = await loadAssetTexture(asset, { variant });
            }
            if (!texture) {
                console.log(`Missing texture for ${entity.name}`);
                return;
            }

            // Create mesh
            const height = (texture.height * width) / texture.width; // Scale height while maintaining aspect ratio
            const [shader, { mesh, instancePositions }] = loadShaderGeometry(
                "entity",
                texture,
                width,
                height,
                { uid: entityUid, anchor, depthFactor: Z_SCALE },
            );
            entityMesh = {
                id: entityUid,
                mesh,
                instancePositions,
            };

            // Set mesh properties
            if (variant != null) {
                entityMesh.properties = { variant };
            }

            // Set initial position
            mesh.x = isoX;
            mesh.y = isoY - topologicalHeight;
            mesh.zIndex = RENDER_ORDER[entityType];
            entityMesh.instancePositions.data.set([
                mesh.x,
                mesh.y,
                (isoY + Z_OFF[entityType]) * Z_SCALE,
            ]);
            entityMesh.instancePositions.update();

            // Add to entityMeshes
            entityMeshes[entityUid] = entityMesh;
            worldStage.removeChild(mesh);
            worldStage.addChild(mesh);
        }
    }

    async function updateEntities(
        er: Record<string, Monster | Player | Item>,
        playerPosition: Position | null,
    ) {
        if (!isInitialized || playerPosition == null || worldStage == null) {
            return;
        }
        for (const entity of Object.values(er)) {
            await upsertEntityMesh(entity);
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

        // Create player mesh
        if ($player) {
            await upsertEntityMesh($player);
        }

        // Add ticker
        app.ticker.add(ticker);

        // Add the canvas to the DOM
        container.appendChild(app.canvas);

        // Set initialized
        isInitialized = true;

        // Resize the canvas
        resize(clientHeight, clientWidth);

        // Initial update
        if (playerPosition && $player) {
            await updatePlayer(playerPosition);
            await updateBiomes(playerPosition);
            await updateEntities($monsterRecord, playerPosition);
            await updateEntities($playerRecord, playerPosition);
            await updateEntities($itemRecord, playerPosition);
            await updateWorlds($worldRecord, playerPosition);
            updateCamera($player, false);
        }
    }

    onMount(() => {
        app = new Application();
        worldStage = new Container();
        worldStage.sortableChildren = true;

        init();

        return () => {
            if (app != null) {
                // app.destroy(true, { children: true, texture: true });
                // app = null;
                // const gl = app.canvas.getContext('webgl')
            }
        };
    });
</script>

{#if playerPosition}
    <div
        class={cn("w-full h-full p-0 m-0", $$restProps.class)}
        bind:this={container}
        bind:clientHeight
        bind:clientWidth
    ></div>
{/if}

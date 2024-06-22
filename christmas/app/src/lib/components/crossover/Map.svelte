<script lang="ts">
    import { PUBLIC_TILED_MINIO_BUCKET } from "$env/static/public";
    import { LRUMemoryCache, memoize } from "$lib/caches";
    import { crossoverCmdMove } from "$lib/crossover";
    import {
        topologyBufferCache,
        topologyResponseCache,
        topologyResultCache,
    } from "$lib/crossover/caches";
    import {
        aStarPathfinding,
        autoCorrectGeohashPrecision,
        cartToIso,
        generateEvenlySpacedPoints,
        getEntityId,
        getPositionsForPath,
        isoToCart,
        seededRandom,
        snapToGrid,
        stringToRandomNumber,
    } from "$lib/crossover/utils";
    import { abilities } from "$lib/crossover/world/abilities";
    import { actions } from "$lib/crossover/world/actions";
    import { bestiary } from "$lib/crossover/world/bestiary";
    import {
        biomeAtGeohash,
        biomes,
        heightAtGeohash,
    } from "$lib/crossover/world/biomes";
    import { compendium } from "$lib/crossover/world/compendium";
    import { MS_PER_TICK } from "$lib/crossover/world/settings";
    import type { AssetMetadata, Direction } from "$lib/crossover/world/types";
    import {
        geohashToGridCell,
        gridCellToGeohash,
    } from "$lib/crossover/world/utils";
    import { worldSeed } from "$lib/crossover/world/world";
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
        FederatedMouseEvent,
        Geometry,
        Mesh,
        Rectangle,
        Shader,
        Sprite,
        Texture,
        Ticker,
        WebGLRenderer,
    } from "pixi.js";
    import { onDestroy, onMount } from "svelte";
    import type { ActionEvent } from "../../../routes/api/crossover/stream/+server";
    import {
        itemRecord,
        monsterRecord,
        player,
        playerRecord,
        target,
        worldRecord,
    } from "../../../store";
    import {
        MAX_SHADER_GEOMETRIES,
        destroyShaders,
        loadShaderGeometry,
        loadedGeometry,
        updateShaderUniforms,
    } from "./shaders";

    // Note: this are cartesian coordinates (CELL_HEIGHT = CELL_WIDTH;)
    const CELL_WIDTH = 64;
    const CELL_HEIGHT = CELL_WIDTH;
    const ISO_CELL_WIDTH = CELL_WIDTH;
    const ISO_CELL_HEIGHT = CELL_HEIGHT / 2;
    const HALF_ISO_CELL_WIDTH = ISO_CELL_WIDTH / 2;
    const HALF_ISO_CELL_HEIGHT = ISO_CELL_HEIGHT / 2;
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
    const { row: bottomRightRow, col: bottomRightCol } =
        geohashToGridCell("pbzupuzv");
    const Z_SCALE =
        -1 /
        cartToIso(bottomRightCol * CELL_WIDTH, bottomRightRow * CELL_HEIGHT)[1];

    // Z layer offsets
    const Z_LAYER = ISO_CELL_HEIGHT;
    const Z_OFF: Record<string, number> = {
        // shader
        biome: 0 * Z_LAYER,
        entity: 1 * Z_LAYER,
        // entities
        item: 1 * Z_LAYER,
        monster: 1 * Z_LAYER,
        player: 1 * Z_LAYER,
        // layers
        ground: 0 * Z_LAYER,
        grass: 0 * Z_LAYER,
        floor: 1 * Z_LAYER,
        wall: 2 * Z_LAYER,
        l2: 3 * Z_LAYER,
        l3: 4 * Z_LAYER,
        // entity: 1 * Z_LAYER,
        // floor: 3 * Z_LAYER,
        // wall: 4 * Z_LAYER,
        // item: 4 * Z_LAYER,
        // monster: 4 * Z_LAYER,
        // player: 4 * Z_LAYER,
        // l2: 8 * Z_LAYER,
        // l3: 12 * Z_LAYER,
    };

    // This is different from depth testing (but used to control when which objects are drawn for alpha blending)
    const RENDER_ORDER: Record<string, number> = {
        ground: 0,
        biome: 0,
        floor: 0,
        wall: 0,
        item: 0,
        // draw last because it has alpha
        grass: 1,
        player: 1,
        monster: 1,
        world: 1,
    };

    // In WebGL, the gl_Position.z value should be in the range [-1 (closer), 1]
    const ELEVATION_TO_CELL_HEIGHT = CELL_HEIGHT / 2 / 8; // 1 meter = 1/8 a cell height (on isometric coordinates)

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

    interface EntityMesh {
        id: string;
        mesh: Mesh<Geometry, Shader>;
        hitbox: Container; // meshes are added to the hitbox so they can be moved together
        instancePositions: Buffer;
        instanceHighlights: Buffer;
        position: Position;
        // row: number;
        // col: number;
        // x: number; // isometric, before adding topologicalHeight
        // y: number;
        // topologicalHeight: number;
        entity?: Player | Monster | Item;
        actionIcon?: Mesh<Geometry, Shader>;
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
    let lastCursorX: number = 0;
    let lastCursorY: number = 0;
    let isMouseDown: boolean = false;
    let path: Direction[] | null = null;

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
    $: highlightTarget($target);

    /*
     * Utility functions
     */

    function updatePlayerPosition(player: Player | null) {
        if (player == null) {
            return;
        }
        calculatePosition(player.loc[0]).then((p) => {
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
            ELEVATION_TO_CELL_HEIGHT *
            (await heightAtGeohash(geohash, {
                responseCache: topologyResponseCache,
                resultsCache: topologyResultCache,
                bufferCache: topologyBufferCache,
            }));
        return { row, col, isoX, isoY, geohash, precision, topologicalHeight };
    }

    function updateCamera(player: Player, tween = true) {
        if (playerPosition != null && worldStage != null) {
            const offsetX = Math.floor(
                playerPosition.isoX + CELL_WIDTH / 2 - clientWidth / 2,
            );
            const offsetY =
                playerPosition.isoY -
                playerPosition.topologicalHeight -
                Math.floor(clientHeight / 2);
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

    /**
     * Server should notify entity perform action on entity to all clients involved for rendering
     * TODO: change game command responses to a message feed not REST response
     */
    export async function drawActionEvent(event: ActionEvent) {
        if (!isInitialized || worldStage == null) {
            return;
        }
        const { source, target, action, ability, utility, prop } = event;

        // Get source entity
        const sourceEntity = entityMeshes[source];
        const targetEntity = target ? entityMeshes[target] : null;

        // Render action/ability/utility
        if (action != null && sourceEntity != null) {
            const { ticks, icon } = actions[action];
            // Show action icon for duration
            const [bundleName, alias] = icon.path.split("/").slice(-2);
            const bundle = await Assets.loadBundle(bundleName);
            const texture = bundle[alias].textures[icon.icon];
            if (sourceEntity.actionIcon != null) {
                swapMeshTexture(sourceEntity.actionIcon, texture);
                sourceEntity.actionIcon.visible = true;
                setTimeout(
                    () => {
                        if (sourceEntity.actionIcon != null) {
                            sourceEntity.actionIcon.visible = false;
                        }
                    },
                    Math.max(ticks * MS_PER_TICK, 1000),
                );
            }
            console.log(source, "performing action on", target);
        } else if (ability != null) {
            const abilityRecord = abilities[ability];
            console.log(source, "performing ability on", target);
        } else if (
            utility != null &&
            prop != null &&
            compendium[prop]?.utilities[utility] != null
        ) {
            const utilityRecord = compendium[prop]?.utilities[utility];
            console.log(source, "performing utility on", target);
        }
    }

    function highlightTarget(target: Player | Monster | Item | null) {
        if (target == null) {
            return;
        }
        const [targetEntityId, entityType] = getEntityId(target);

        // Highlight target entity and unhighlight others
        for (const [entityId, { instanceHighlights }] of Object.entries(
            entityMeshes,
        )) {
            if (entityId === targetEntityId) {
                instanceHighlights.data.fill(1);
            } else {
                instanceHighlights.data.fill(0);
            }
            instanceHighlights.update();
        }
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

        // TODO: this is pretty inefficient we we need to keep loading everytime player moves

        // Load worlds
        for (const w of Object.values(worlds)) {
            const origin = autoCorrectGeohashPrecision(
                w.loc[0],
                worldSeed.spatial.unit.precision,
            );
            await loadWorld({
                world: w,
                position: await calculatePosition(origin),
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
            { texture, positions, width, height, length },
        ] of Object.entries(shaderTextures)) {
            const [shader, { geometry, instancePositions }] =
                loadShaderGeometry(shaderName, texture, width, height, {
                    instanceCount: numGeometries,
                    zScale: Z_SCALE,
                });

            const mesh = new Mesh<Geometry, Shader>({ geometry, shader });

            // Set geometry instance count
            geometry.instanceCount = length / 3; // x, y, h

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

    function highlightShaderInstances(
        shaderName: string,
        highlightPositions: Record<string, number>, // {'x,y': highlight}
    ) {
        for (const [
            _,
            { shader, instanceHighlights, instancePositions },
        ] of Object.entries(loadedGeometry)) {
            if (shader === shaderName) {
                // Iterate `instancePositions` and compare with `highlightPositions`
                for (let i = 0; i < instanceHighlights.data.length; i += 1) {
                    const p = i * 3;
                    const x = instancePositions.data[p];
                    const y = instancePositions.data[p + 1];
                    instanceHighlights.data[i] =
                        highlightPositions[`${x},${y}`] ?? 0;
                }
                instanceHighlights.update();
            }
        }
    }

    const calculateBiomeForRowCol = memoize(
        _calculateBiomeForRowCol,
        biomeCache,
        (playerPosition, row, col) => `${row}-${col}`,
    );
    async function _calculateBiomeForRowCol(
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
            ELEVATION_TO_CELL_HEIGHT *
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
        // Note: snap to grid for biomes, so that we can do O(1) lookups for highlights
        const [isoX, isoY] = cartToIso(col * CELL_WIDTH, row * CELL_HEIGHT, {
            x: HALF_ISO_CELL_WIDTH,
            y: HALF_ISO_CELL_HEIGHT,
        });

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

    const calculateBiomeDecorationsForRowCol = memoize(
        _calculateBiomeDecorationsForRowCol,
        biomeDecorationsCache,
        ({ row, col }) => `${row}-${col}`,
    );
    async function _calculateBiomeDecorationsForRowCol({
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
                        ).fill(-1), // x, y, h
                        height: texture.height,
                        width: texture.width,
                        length: 0,
                    };
                }

                // Evenly space out decorations and add jitter
                const jitter = ((instanceRv - 0.5) * CELL_WIDTH) / 2;
                const x = spacedOffsets[i].x + isoX + jitter;
                const y = spacedOffsets[i].y + isoY + jitter;

                // Add to decoration positions
                texturePositions[texture.uid].positions![
                    texturePositions[texture.uid].length
                ] = x;
                texturePositions[texture.uid].positions![
                    texturePositions[texture.uid].length + 1
                ] = y;
                texturePositions[texture.uid].positions![
                    texturePositions[texture.uid].length + 2
                ] = topologicalHeight;
                texturePositions[texture.uid].length += 3;
            }
        }
        return texturePositions;
    }

    async function updateBiomes(playerPosition: Position | null) {
        if (!isInitialized || playerPosition == null || $player == null) {
            return;
        }

        // Clear shader textures
        biomeTexturePositions = {};
        biomeDecorationsTexturePositions = {};

        // Create biome shader instances
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
                } = await calculateBiomeForRowCol(playerPosition, row, col);

                if (biomeTexturePositions[texture.uid] == null) {
                    biomeTexturePositions[texture.uid] = {
                        texture,
                        positions: new Float32Array(
                            MAX_SHADER_GEOMETRIES * 3,
                        ).fill(-1), // x, y, h
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
                    ] = isoY;
                    biomeTexturePositions[texture.uid].positions![
                        biomeTexturePositions[texture.uid].length + 2
                    ] = topologicalHeight;
                    biomeTexturePositions[texture.uid].length += 3;
                }

                // Fill biomeDecorationsTexturePositions
                for (const [
                    textureUid,
                    { positions, texture, height, width, length },
                ] of Object.entries(
                    await calculateBiomeDecorationsForRowCol({
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
                            ).fill(-1), // x, y, h
                            width,
                            height,
                            length: 0,
                        };
                    } else {
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

    async function debugColliders() {
        if (worldStage == null) {
            return;
        }
        const colliderTexture = (await Assets.loadBundle("actions"))["actions"]
            .textures["hiking"];

        // Draw world colliders
        for (const worlds of Object.values($worldRecord)) {
            for (const w of Object.values(worlds)) {
                const origin = autoCorrectGeohashPrecision(
                    (w as World).loc[0],
                    worldSeed.spatial.unit.precision,
                );
                const position = await calculatePosition(origin);

                for (const cld of w.cld) {
                    const { row, col } = geohashToGridCell(cld);

                    // Create sprite
                    const sprite = new Sprite(colliderTexture);
                    sprite.width = CELL_WIDTH;
                    sprite.height =
                        (colliderTexture.height * sprite.width) /
                        colliderTexture.width;
                    sprite.anchor.set(0.5, 1);

                    // Convert cartesian to isometric position
                    const [isoX, isoY] = cartToIso(
                        col * CELL_WIDTH,
                        row * CELL_HEIGHT,
                    );
                    sprite.x = isoX;
                    sprite.y = isoY - position.topologicalHeight;
                    worldStage.addChild(sprite);
                }
            }
        }
    }

    function decodeTiledSource(path: string): string {
        const source = decodeURIComponent(path) // strip '../'
            .split("/")
            .slice(1)
            .join("/");
        return `/api/storage/${PUBLIC_TILED_MINIO_BUCKET}/public/${source}`;
    }

    async function getTilesetForTile(
        tileId: number,
        sortedTilesets: { firstgid: number; source: string }[],
    ): Promise<{ firstgid: number; tileset: any }> {
        for (const ts of sortedTilesets) {
            if (tileId >= ts.firstgid) {
                return {
                    tileset: await Assets.load(decodeTiledSource(ts.source)), // this is cached
                    firstgid: ts.firstgid,
                };
            }
        }
        throw new Error(`Missing tileset for tileId ${tileId}`);
    }

    async function getImageForTile(
        tiles: {
            id: number;
            image: string;
            imagewidth: number;
            imageheight: number;
        }[],
        tileId: number,
    ): Promise<{ texture: Texture; imagewidth: number; imageheight: number }> {
        for (const tile of tiles) {
            if (tile.id === tileId) {
                return {
                    texture: await Assets.load(decodeTiledSource(tile.image)),
                    imagewidth: tile.imagewidth,
                    imageheight: tile.imageheight,
                }; // this is cached
            }
        }
        throw new Error(`Missing image for tileId ${tileId}`);
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

        // await debugColliders();

        const tilemap = await Assets.load(world.url);
        const { layers, tilesets, tileheight, tilewidth } = tilemap;
        const [tileOffsetX, tileOffsetY] = cartToIso(
            tilewidth / 2,
            tilewidth / 2,
        );

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
            const props: { name: string; value: any; type: string }[] =
                properties ?? [];

            // Get properties
            const { z, collider, interior } = props.reduce(
                (acc: Record<string, any>, { name, value, type }) => {
                    acc[name] = value;
                    return acc;
                },
                {},
            );

            const sortedTilesets = tilesets
                .sort((a: any, b: any) => a.firstgid - b.firstgid)
                .reverse();

            // Create tile sprites
            for (let i = 0; i < height; i++) {
                for (let j = 0; j < width; j++) {
                    const tileId = data[i * width + j];
                    if (tileId === 0) {
                        continue;
                    }
                    const id = `${town}-${world.world}-${tileId}-${i}-${j}`;

                    // Skip if already created
                    if (id in worldMeshes) {
                        continue;
                    }

                    // Get tileset for tileId
                    const { tileset, firstgid } = await getTilesetForTile(
                        tileId,
                        sortedTilesets,
                    );

                    // Get image for tileId
                    const { texture, imageheight, imagewidth } =
                        await getImageForTile(tileset.tiles, tileId - firstgid);

                    console.log(tileheight, tilewidth, imageheight, imagewidth);

                    const [isoX, isoY] = cartToIso(
                        j * tilewidth,
                        i * tilewidth, // use imagewidth for cartesian
                    );

                    // const [isoX, isoY] = cartToIso(
                    //     j * imagewidth,
                    //     i * imagewidth, // use imagewidth for cartesian
                    // );

                    const [
                        shader,
                        { geometry, instancePositions, instanceHighlights },
                    ] = loadShaderGeometry(
                        "world",
                        texture,
                        imagewidth,
                        imageheight,
                        {
                            // Note: anchor is not used in entity meshes shader
                            uid: id,
                            zScale: Z_SCALE,
                            zOffset: Z_OFF[z] ?? Z_OFF.floor,
                            cellHeight: tileheight / ISO_CELL_HEIGHT,
                        },
                    );

                    const mesh = new Mesh<Geometry, Shader>({
                        geometry,
                        shader,
                    });

                    // Center of the bottom tile (imageheight a multiple of tileheight)
                    const anchor = {
                        x: 0.5,
                        y: 1 - tileheight / imageheight / 2,
                    };

                    // Set initial position
                    const x =
                        isoX +
                        (offsetx ?? 0) +
                        position.isoX +
                        tileOffsetX -
                        anchor.x * imagewidth;
                    const y =
                        isoY +
                        (offsety ?? 0) +
                        position.isoY +
                        tileOffsetY -
                        anchor.y * imageheight;
                    mesh.x = x;
                    mesh.y = y - position.topologicalHeight;
                    mesh.zIndex = RENDER_ORDER[z] || RENDER_ORDER.world;
                    instancePositions.data.set([
                        x,
                        y + imageheight, // this is only used to calculate z
                        position.topologicalHeight, // this is not used to calculate z
                    ]);
                    instancePositions.update();

                    // Add to worldMeshes
                    const worldMesh = {
                        id,
                        mesh,
                        instancePositions,
                        instanceHighlights,
                        hitbox: new Container(), // Not used for world meshes
                        position: position, // Not used for world meshes
                    };

                    worldMeshes[id] = worldMesh;
                    worldStage.removeChild(mesh);
                    worldStage.addChild(mesh);
                }
            }
        }
    }

    function swapMeshTexture(mesh: Mesh<Geometry, Shader>, texture: Texture) {
        mesh.shader.resources.uTexture = texture.source;
        const { x0, y0, x1, y1, x2, y2, x3, y3 } = texture.uvs;
        const uvBuffer = mesh.geometry.getBuffer("aUV");
        uvBuffer.data.set([x0, y0, x1, y1, x2, y2, x3, y3]);
        uvBuffer.update();
    }

    async function swapEntityVariant(entityMesh: EntityMesh, variant: string) {
        if (entityMesh.entity == null) {
            return;
        }

        let texture: Texture | null = null;

        if (entityMesh.properties!.variant !== variant) {
            if ((entityMesh.entity as Item).prop) {
                const item = entityMesh.entity as Item;
                const prop = compendium[item.prop];
                const variant = prop.states[item.state].variant;
                texture = await loadAssetTexture(prop.asset, {
                    variant,
                });
            }
        }

        if (!texture) {
            console.error(
                `Missing texture for ${entityMesh.entity.name}:${variant}`,
            );
            return;
        }

        entityMesh.properties!.variant = variant;
        swapMeshTexture(entityMesh.mesh, texture);
    }

    function updateEntityMeshRenderOrder(entityMesh: EntityMesh) {
        if (entityMesh.entity == null) {
            return;
        }
        const [_, entityType] = getEntityId(entityMesh.entity);
        const zIndex = RENDER_ORDER[entityType] * entityMesh.position.isoY; // TODO: this does not work during tweening
        entityMesh.mesh.zIndex = zIndex;
        if (entityMesh.actionIcon != null) {
            entityMesh.actionIcon.zIndex = zIndex;
        }
        entityMesh.hitbox.zIndex = zIndex;
    }

    function destroyEntityMesh(entityMesh: EntityMesh) {
        if (worldStage == null) {
            return;
        }
        worldStage.removeChild(entityMesh.mesh);
        entityMesh.mesh.destroy();
        if (entityMesh.actionIcon != null) {
            worldStage.removeChild(entityMesh.actionIcon);
            entityMesh.actionIcon.destroy();
        }
        worldStage.removeChild(entityMesh.hitbox);
        entityMesh.hitbox.destroy();

        // TODO: Destroy shaders & geometry
    }

    async function updatePlayer(playerPosition: Position | null) {
        if (
            !isInitialized ||
            playerPosition == null ||
            worldStage == null ||
            $player == null
        ) {
            return;
        }

        // Cull entity meshes outside view
        for (const [id, entityMesh] of Object.entries(entityMeshes)) {
            if (!isCellInView(entityMesh.position, playerPosition)) {
                destroyEntityMesh(entityMesh);
                delete entityMeshes[id];
            }
        }

        // Cull world meshes outside town
        const town = playerPosition.geohash.slice(
            0,
            worldSeed.spatial.town.precision,
        );
        for (const [id, entityMesh] of Object.entries(worldMeshes)) {
            if (!id.startsWith(town)) {
                destroyEntityMesh(entityMesh);
                delete worldMeshes[id];
            }
        }

        // Player
        const playerMesh = entityMeshes[$player.player];
        if (playerMesh != null && playerMesh.mesh != null) {
            // Update
            playerMesh.instancePositions.data.set([
                playerPosition.isoX,
                playerPosition.isoY,
                playerPosition.topologicalHeight,
            ]);
            playerMesh.instancePositions.update();
            playerMesh.hitbox.x = playerPosition.isoX;
            playerMesh.hitbox.y =
                playerPosition.isoY - playerPosition.topologicalHeight;
            playerMesh.position = playerPosition;

            // Set render order
            updateEntityMeshRenderOrder(playerMesh);
        }

        // Move camera to player
        updateCamera($player);
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

    async function upsertEntityMesh(entity: Player | Item | Monster) {
        if (worldStage == null || playerPosition == null || $player == null) {
            return;
        }

        const [entityId, entityType] = getEntityId(entity);

        // Get position
        const position = await calculatePosition(entity.loc[0]);
        const { row, col, isoX, isoY, topologicalHeight } = position;

        // Ignore entities outside player's view
        if (!isCellInView({ row, col }, playerPosition)) {
            return;
        }

        // Update
        let entityMesh = entityMeshes[entityId];
        if (entityMesh != null) {
            if (entityType === "player") {
            } else if (entityType === "monster") {
            } else if (entityType === "item") {
                const item = entity as Item;
                const prop = compendium[item.prop];
                const variant = prop.states[item.state].variant;
                await swapEntityVariant(entityMesh, variant);
            }

            // Update
            entityMesh.instancePositions.data.set([
                isoX,
                isoY,
                topologicalHeight,
            ]);
            entityMesh.instancePositions.update();
            entityMesh.hitbox.x = isoX;
            entityMesh.hitbox.y = isoY - topologicalHeight;
            entityMesh.position = position;

            // Set render order
            updateEntityMeshRenderOrder(entityMesh);

            // Add again as it might have been removed during culling
            worldStage.removeChild(entityMesh.hitbox);
            worldStage.addChild(entityMesh.hitbox);
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

            // Create entity mesh
            const height = (texture.height * width) / texture.width; // Scale height while maintaining aspect ratio
            const [
                shader,
                { geometry, instancePositions, instanceHighlights },
            ] = loadShaderGeometry("entity", texture, width, height, {
                uid: entityId,
                anchor,
                zScale: Z_SCALE,
                zOffset: Z_OFF.entity,
            });
            const mesh = new Mesh<Geometry, Shader>({ geometry, shader });

            // Create a hitbox for cursor events (can't use the mesh directly because the position is set in shaders)
            const hitbox = new Container({
                width: width,
                height: height,
                x: isoX,
                y: isoY - topologicalHeight,
                pivot: {
                    x: anchor.x * width,
                    y: anchor.y * height,
                },
                interactive: true,
                hitArea: new Rectangle(0, 0, width, height),
                onmouseover: () => {
                    instanceHighlights.data.fill(1);
                    instanceHighlights.update();
                },
                onmouseleave: () => {
                    if (
                        $target == null ||
                        getEntityId($target)[0] != entityId
                    ) {
                        instanceHighlights.data.fill(0);
                        instanceHighlights.update();
                    }
                },
                onclick: () => {
                    // Set target
                    target.set(entity);
                },
            });
            hitbox.addChild(mesh);

            // Create entity mesh
            entityMesh = {
                id: entityId,
                mesh,
                instancePositions,
                instanceHighlights,
                hitbox,
                entity,
                position,
            };

            // Set initial position (entities only use instancePositions for calculuation z)
            entityMesh.instancePositions.data.set([
                isoX,
                isoY,
                topologicalHeight,
            ]);
            entityMesh.instancePositions.update();

            // Set mesh properties
            if (variant != null) {
                entityMesh.properties = { variant };
            }

            // Create action icon
            if (entityType === "player" || entityType === "monster") {
                const [shader, { geometry }] = loadShaderGeometry(
                    "icon",
                    Texture.EMPTY, // use texture swap to change icon
                    CELL_WIDTH / 2,
                    CELL_HEIGHT / 2,
                    {
                        uid: entityId, // use entityId as texture uid
                        zScale: Z_SCALE,
                        zOffset: Z_OFF.icon,
                    },
                );
                const iconMesh = new Mesh<Geometry, Shader>({
                    geometry,
                    shader,
                });
                iconMesh.visible = false; // hide by default

                // Set icon position to bottom of entity mesh
                hitbox.addChild(iconMesh);
                iconMesh.pivot.set(iconMesh.width / 2, iconMesh.height / 2);
                iconMesh.position.set(hitbox.width / 2, hitbox.height * 0.9);

                entityMesh.actionIcon = iconMesh;
            }

            // Set render order
            updateEntityMeshRenderOrder(entityMesh);

            // Add to worldStage
            entityMeshes[entityId] = entityMesh;
            worldStage.removeChild(hitbox);
            worldStage.addChild(hitbox);
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

    function calculateRowColFromIso(
        isoX: number,
        isoY: number,
    ): [number, number] {
        const [cartX, cartY] = isoToCart(isoX, isoY);
        const col = Math.round(cartX / CELL_WIDTH);
        const row = Math.round(cartY / CELL_HEIGHT);
        return [row, col];
    }

    function getDirectionsToPosition(
        playerPosition: Position,
        target: { x: number; y: number },
    ): Direction[] {
        const [rowEnd, colEnd] = calculateRowColFromIso(target.x, target.y);
        return aStarPathfinding({
            colStart: playerPosition.col,
            rowStart: playerPosition.row,
            colEnd,
            rowEnd,
            getTraversalCost: (row, col) => {
                return 0; // TODO: add actual traversal cost
            },
        });
    }

    function onMouseMove(x: number, y: number) {
        if (playerPosition == null) {
            return;
        }

        if (isMouseDown) {
            // Calculate path (astar)
            path = getDirectionsToPosition(playerPosition, { x, y });

            // Highlight path
            const highlights = Object.fromEntries(
                getPositionsForPath(
                    { row: playerPosition.row, col: playerPosition.col },
                    path,
                ).map(({ row, col }) => {
                    const [x, y] = cartToIso(
                        col * CELL_WIDTH,
                        row * CELL_HEIGHT,
                        {
                            x: HALF_ISO_CELL_WIDTH,
                            y: HALF_ISO_CELL_HEIGHT,
                        },
                    );
                    return [`${x},${y}`, 1];
                }),
            );
            highlightShaderInstances("biome", highlights);
        }
    }

    async function onMouseUp(x: number, y: number) {
        if (playerPosition == null) {
            return;
        }
        // Clear highlights
        highlightShaderInstances("biome", {});

        // Move command
        if (path != null && path.length > 0) {
            await crossoverCmdMove({ path });
        }
    }

    function onMouseDown(x: number, y: number) {
        if (playerPosition == null || worldStage == null) {
            return;
        }
        // Clear path
        path = null;
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
            "actions",
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

        // Setup app events
        app.stage.eventMode = "static"; // enable interactivity
        app.stage.interactive = true;
        app.stage.hitArea = app.screen; // ensure whole canvas area is interactive

        function getMousePosition(e: FederatedMouseEvent) {
            return snapToGrid(
                e.global.x + worldStage!.pivot.x,
                e.global.y +
                    worldStage!.pivot.y +
                    playerPosition!.topologicalHeight, // select on the same plane as player
                HALF_ISO_CELL_WIDTH,
                HALF_ISO_CELL_HEIGHT,
            );
        }
        app.stage.addEventListener("pointerup", (e) => {
            if (playerPosition != null) {
                const [snapX, snapY] = getMousePosition(e);
                onMouseUp(snapX, snapY);
                lastCursorX = snapX;
                lastCursorY = snapY;
                isMouseDown = false;
            }
        });
        app.stage.addEventListener("pointerdown", (e) => {
            if (playerPosition != null) {
                const [snapX, snapY] = getMousePosition(e);
                onMouseDown(snapX, snapY);
                lastCursorX = snapX;
                lastCursorY = snapY;
                isMouseDown = true;
            }
        });
        app.stage.addEventListener("pointermove", (e) => {
            if (playerPosition != null) {
                const [snapX, snapY] = getMousePosition(e);
                if (lastCursorX !== snapX || lastCursorY !== snapY) {
                    onMouseMove(snapX, snapY);
                    lastCursorX = snapX;
                    lastCursorY = snapY;
                }
            }
        });

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

        // Initialize
        init();
    });

    onDestroy(() => {
        if (app) {
            destroyShaders();
            app.destroy(true, {
                children: true,
                texture: true,
            });
            app = null;
        }
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

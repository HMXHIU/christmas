<script lang="ts">
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
    import { biomeAtGeohash } from "$lib/crossover/world/biomes";
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
    } from "pixi.js";
    import { onMount } from "svelte";
    import {
        itemRecord,
        monsterRecord,
        player,
        playerRecord,
        worldRecord,
    } from "../../../store";

    import { loadShaderGeometry, updateShaderWorldTransform } from "./shaders";

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

    const [isoGridX, isoGridY] = cartToIso(
        GRID_COLS * CELL_WIDTH,
        GRID_ROWS * CELL_HEIGHT,
    );

    // Z layers
    const ground = 0;
    const floor = isoGridY;
    const hip = 2 * isoGridY;
    const humanoid = 3 * isoGridY;
    const wall = 3 * isoGridY;
    const l2 = 4 * isoGridY;
    const l3 = 5 * isoGridY;
    const l4 = 6 * isoGridY;
    const zlayers: Record<string, number> = {
        ground,
        floor,
        hip,
        humanoid,
        wall,
        l2,
        l3,
        l4,
        biome: ground,
        monster: humanoid,
        item: hip,
        player: humanoid,
    };

    const app = new Application();
    const worldStage = new Container();

    interface GridSprite {
        id: string;
        sprite: Sprite | Container;
        x: number; // in isometric
        y: number;
        row: number; // in cells
        col: number;
        variant?: string;
    }
    let entityGridSprites: Record<string, GridSprite> = {};
    let worldGridSprites: Record<string, GridSprite> = {};
    let pivotTarget: { x: number; y: number } = { x: 0, y: 0 };
    const decorations = new Set();

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
        if (playerSprite) {
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
        if (isInitialized && clientHeight && clientWidth) {
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
        // sprite.zIndex = zlayers.humanoid + isoY + 1000000000000;
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
        //     sprite.zIndex = zlayers.humanoid + isoY + 1000000000000;
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
                    sprite.zIndex = (zlayers[z] ?? zlayers.ground) + sprite.y;

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
        if (!isInitialized || playerCell == null) {
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
        const town = gridCellToGeohash(playerCell).slice(
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
            playerSprite.x = isoX;
            playerSprite.y = isoY - CELL_HEIGHT / 4; // isometric cell height is half of cartesian cell height
            playerSprite.zIndex = zlayers.player + playerSprite.y;
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
        const town = gridCellToGeohash(playerCell).slice(
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

    async function updateBiomeDecorations(
        decorationTexturePositions: Record<
            string, // texture uid
            {
                texture: Texture;
                positions: [number, number];
            }
        >,
    ) {
        for (const [textureUid, { texture, positions }] of Object.entries(
            decorationTexturePositions,
        )) {
            // TODO: dont hardcode shader name
            const [shader, { geometry, instancePositions, mesh }] =
                loadShaderGeometry("grass", texture, 1000);

            // Update instance positions buffer
            if (instancePositions) {
                // TODO: Optimize this
                for (let i = 0; i < positions.length; i++) {
                    instancePositions.data[i] = positions[i];
                }
                instancePositions.update();
            }

            // Add mesh with instanced geometry to world
            if (mesh && !decorations.has(textureUid)) {
                app.stage.addChild(mesh);
            }
        }
    }

    async function updateBiomes(playerCell: GridCell | null) {
        if (!isInitialized || playerCell == null) {
            return;
        }

        const decorationTexturePositions: Record<
            string, // texture uid
            {
                texture: Texture;
                positions: [number, number];
            }
        > = {};

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
                // Determine biome and load asset
                const geohash = gridCellToGeohash({
                    precision: playerCell.precision,
                    row,
                    col,
                });
                const biomeId = `biome-${geohash}`;

                // Skip if already created
                if (biomeId in entityGridSprites) {
                    continue;
                }

                // Get biome asset
                const [biome, strength] = biomeAtGeohash(geohash);
                const asset = biomes[biome].asset;
                if (!asset) {
                    console.error(`Missing asset for ${biome}`);
                    continue;
                }

                // Load texture
                const texture = await loadAssetTexture(asset, {
                    seed: (row << 8) + col,
                }); // bit shift by 8 else gridRow + gridCol is the same at diagonals
                if (!texture) {
                    console.error(`Missing texture for ${biome}`);
                    continue;
                }

                // Create sprite
                const sprite = new Sprite(texture);
                sprite.anchor.set(0.5); // TODO: set anchor in sprite.json not here as each asset is different
                sprite.width = CELL_WIDTH; // Biome sprite is scaled to CELL_WIDTH
                sprite.height = (texture.height * sprite.width) / texture.width; // maintain aspect ratio

                // Convert cartesian to isometric position
                const [isoX, isoY] = cartToIso(
                    col * CELL_WIDTH,
                    row * CELL_HEIGHT,
                );
                sprite.x = isoX;
                sprite.y = isoY;
                sprite.zIndex = zlayers.biome + row + col;

                // Remove old sprite
                if (
                    biomeId in entityGridSprites &&
                    entityGridSprites[biomeId].sprite != null
                ) {
                    worldStage.removeChild(entityGridSprites[biomeId].sprite);
                    entityGridSprites[biomeId].sprite.destroy();
                }

                // Add to entityGridSprites
                entityGridSprites[biomeId] = {
                    id: biomeId,
                    sprite: worldStage.addChild(sprite),
                    x: sprite.x,
                    y: sprite.y,
                    row,
                    col,
                };

                /*
                 * Create biome decorations
                 */

                // Get biome decorations
                const decorations = biomes[biome].decorations;
                if (!decorations) {
                    continue;
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

                        // M1: Create sprite
                        //
                        // const sprite = new Sprite(texture);
                        // sprite.width = asset.width * CELL_WIDTH;
                        // sprite.height =
                        //     (texture.height * sprite.width) / texture.width; // maintain aspect ratio

                        // // M2: Create mesh
                        // const [shader, geometry] = loadShaderGeometry(
                        //     "grass",
                        //     await Assets.load(
                        //         "https://pixijs.com/assets/bg_scene_rotate.jpg",
                        //     ),
                        // );
                        // const sprite = new Mesh({
                        //     geometry,
                        //     shader,
                        // });
                        // sprite.width = asset.width * CELL_WIDTH;
                        // sprite.height =
                        //     (texture.height * sprite.width) / texture.width; // maintain aspect ratio

                        // M3: Create mesh using instanced geometry

                        // Evenly space out decorations and add jitter
                        const jitter = ((instanceRv - 0.5) * sprite.width) / 2;
                        const x = spacedOffsets[i].x + isoX + jitter;
                        const y =
                            spacedOffsets[i].y +
                            isoY +
                            jitter -
                            CELL_HEIGHT / 4; // isometric cell height is half of cartesian cell height;
                        // sprite.zIndex = zlayers.biome + sprite.y;

                        if (decorationTexturePositions[texture.uid] == null) {
                            decorationTexturePositions[texture.uid] = {
                                texture,
                                positions: [x, y],
                            };
                        } else {
                            decorationTexturePositions[
                                texture.uid
                            ].positions.push(x, y);
                        }

                        // // Add random skew
                        // const rad = ((instanceRv - 0.5) * Math.PI) / 8;
                        // sprite.skew = { x: rad, y: rad };

                        // Add random tint
                        // sprite.tint = 0x9cb409; // tint green
                        // sprite.tint = 0x587902; // tint green

                        // For debugging instances
                        // if (i == 1) {
                        //     sprite.tint = 0xff0000;
                        // } else if (i == 2) {
                        //     sprite.tint = 0x0000ff;
                        // } else if (i == 3) {
                        //     sprite.tint = 0x00ff00; // tint green
                        // }

                        // // Remove old sprite
                        // const decorationId = `${biomeId}-${name}-${i}`;
                        // if (
                        //     decorationId in entityGridSprites &&
                        //     entityGridSprites[decorationId].sprite != null
                        // ) {
                        //     worldStage.removeChild(
                        //         entityGridSprites[decorationId].sprite,
                        //     );
                        //     entityGridSprites[decorationId].sprite.destroy();
                        // }

                        // // Add to entityGridSprites
                        // entityGridSprites[decorationId] = {
                        //     id: decorationId,
                        //     sprite: worldStage.addChild(sprite),
                        //     x: sprite.x,
                        //     y: sprite.y,
                        //     row,
                        //     col,
                        // };
                    }
                }
            }
        }

        // Update biome decorations
        updateBiomeDecorations(decorationTexturePositions);
    }

    async function updateItems(
        ir: Record<string, Item>,
        playerCell: GridCell | null,
    ) {
        if (!isInitialized || playerCell == null) {
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
                sprite.y = isoY - CELL_HEIGHT / 4; // isometric cell height is half of cartesian cell height
                sprite.zIndex = zlayers.item + sprite.y;
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
                sprite.y = isoY - CELL_HEIGHT / 4; // isometric cell height is half of cartesian cell height
                sprite.zIndex = zlayers.item + row + col;

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
        if (!isInitialized || playerCell == null) {
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
                sprite.zIndex = zlayers.monster + sprite.y;
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
                sprite.zIndex = zlayers[entityType] + row + col;

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
        await app.init({
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            antialias: false,
            preference: "webgl",
        });

        await initAssetManager();

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

        // Ticker
        app.ticker.add((deltaTime) => {
            // Move camera to target position (prevent jitter at the end)
            const deltaX = pivotTarget.x - worldStage.pivot.x;
            if (Math.abs(deltaX) > 5) {
                worldStage.pivot.x += (deltaX * deltaTime.elapsedMS) / 1000;
            }
            const deltaY = pivotTarget.y - worldStage.pivot.y;
            if (Math.abs(deltaY) > 5) {
                worldStage.pivot.y += (deltaY * deltaTime.elapsedMS) / 1000;
            }

            // Update shader world transform
            updateShaderWorldTransform(worldStage.worldTransform);
        });

        // Add the canvas to the DOM
        container.appendChild(app.canvas);
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
        init();
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

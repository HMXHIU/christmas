<script lang="ts">
    import {
        autoCorrectGeohashPrecision,
        cartToIso,
        entityId,
        seededRandom,
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
    import { groupBy } from "lodash";
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

    const zlayers = {
        biome: 0,
        monster: 10000000000,
        item: 1000000000,
        player: 100000000,
        world: 100000001,
    };

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
    let CANVAS_WIDTH = CELL_WIDTH * CANVAS_COLS;
    let CANVAS_HEIGHT = CELL_HEIGHT * CANVAS_ROWS;
    let WORLD_WIDTH = CANVAS_WIDTH * OVERDRAW_MULTIPLE;
    let WORLD_HEIGHT = CANVAS_HEIGHT * OVERDRAW_MULTIPLE;
    let GRID_ROWS = CANVAS_ROWS * OVERDRAW_MULTIPLE;
    let GRID_COLS = CANVAS_COLS * OVERDRAW_MULTIPLE;
    let GRID_MID_ROW = Math.floor(GRID_ROWS / 2);
    let GRID_MID_COL = Math.floor(GRID_COLS / 2);

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
    let gridSprites: Record<string, GridSprite> = {};
    let pivotTarget: { x: number; y: number } = { x: 0, y: 0 };

    $: playerCell = $player && geohashToGridCell($player.location[0]);
    $: updatePlayer(playerCell);
    $: updateBiomes(playerCell);
    $: updateWorlds($worldRecord);
    $: updateCreatures($monsterRecord);
    $: updateCreatures($playerRecord);
    $: updateItems($itemRecord);
    $: resize(clientHeight, clientWidth);

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

    function isCellInView(cell: GridCell, playerCell: GridCell): boolean {
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
        const bundle = await Assets.loadBundle(asset.bundle);
        // Bundle might be a sprite sheet or image
        const frame =
            bundle[asset.name]?.textures?.[
                asset.variants?.[variant] || "default"
            ] || bundle[asset.name];
        return frame || null;
    }

    async function updatePlayer(playerCell: GridCell | null) {
        if (!isInitialized || playerCell == null) {
            return;
        }

        // Cull sprites outside view
        for (const [id, entity] of Object.entries(gridSprites)) {
            if (
                entity.row > playerCell.row + GRID_MID_ROW ||
                entity.row < playerCell.row - GRID_MID_ROW ||
                entity.col > playerCell.col + GRID_MID_COL ||
                entity.col < playerCell.col - GRID_MID_COL
            ) {
                gridSprites[id].sprite.destroy();
                delete gridSprites[id];
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

        for (const w of Object.values(worlds)) {
            const origin = autoCorrectGeohashPrecision(
                w.loc[0],
                worldSeed.spatial.unit.precision,
            );
            const originCell = geohashToGridCell(origin);
            const container = await createWorldContainer({
                url: w.url,
                origin: originCell,
            });
            worldStage.addChild(container);
        }
    }

    async function updateBiomes(playerCell: GridCell | null) {
        if (!isInitialized || playerCell == null) {
            return;
        }

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
                const biome = biomeAtGeohash(geohash);
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

                // Add to gridSprites
                const biomeId = `biome-${geohash}`;
                gridSprites[biomeId] = {
                    id: biomeId,
                    sprite: worldStage.addChild(sprite),
                    x: sprite.x,
                    y: sprite.y,
                    row,
                    col,
                };
            }
        }
    }

    async function updateItems(ir: Record<string, Item>) {
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
            if (item.item in gridSprites) {
                const { sprite, variant: oldVariant } = gridSprites[item.item];

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
                    gridSprites[item.item].variant = variant;
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

                // Add to gridSprites
                gridSprites[item.item] = {
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

    async function updateCreatures(er: Record<string, Monster | Player>) {
        if (!isInitialized || playerCell == null) {
            return;
        }

        for (const entity of Object.values(er)) {
            const cell = geohashToGridCell(entity.location[0]);
            const { row, col } = cell;

            // Ignore entities outside player's view
            if (!isCellInView(cell, playerCell)) {
                continue;
            }

            const [id, entityType] = entityId(entity);

            // Update
            if (id in gridSprites) {
                const sprite = gridSprites[id].sprite;
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

                // Add to gridSprites
                gridSprites[id] = {
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

    async function createWorldContainer({
        url,
        origin,
    }: {
        url: string;
        origin: GridCell;
    }): Promise<Container> {
        const tilemap = await Assets.load(url);
        const tileset = await Assets.load(tilemap.tilesets[0].source);
        const spriteContainer = new Container();

        for (const layer of tilemap.layers) {
            const { data, properties, offsetx, offsety, width, height, x, y } =
                layer;
            // Get properties
            const { interior, collider } = groupBy(properties, "name");

            // Create tile sprites
            for (let i = 0; i < height; i++) {
                for (let j = 0; j < width; j++) {
                    const tileId = data[i * width + j];
                    if (tileId === 0) {
                        continue;
                    }
                    const { image, imageheight, imagewidth } =
                        tileset.tiles[tileId - 1];

                    const texture = await Assets.load(image);
                    const sprite = new Sprite(texture);
                    const [isoX, isoY] = cartToIso(
                        j * imagewidth,
                        (i * imageheight) / 2,
                    );
                    sprite.x = isoX + (offsetx || 0);
                    sprite.y = isoY + (offsety || 0);
                    spriteContainer.addChild(sprite);
                }
            }
        }

        // Convert cartesian to isometric position
        const [isoX, isoY] = cartToIso(
            origin.col * CELL_WIDTH,
            origin.row * CELL_HEIGHT,
        );
        spriteContainer.x = isoX;
        spriteContainer.y = isoY;
        spriteContainer.zIndex = zlayers.world + spriteContainer.y;
        return spriteContainer;
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

    async function init() {
        // Load assets in background
        await Assets.init({ manifest: "/sprites/manifest.json" });
        Assets.backgroundLoadBundle([
            "player",
            "biomes",
            "bestiary",
            "props",
            "pedestals",
        ]);

        await app.init({
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            antialias: false,
        });

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
            // Move camera to target position
            worldStage.pivot.x +=
                ((pivotTarget.x - worldStage.pivot.x) * deltaTime.elapsedMS) /
                1000;
            worldStage.pivot.y +=
                ((pivotTarget.y - worldStage.pivot.y) * deltaTime.elapsedMS) /
                1000;
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
            await updateCreatures($monsterRecord);
            await updateCreatures($playerRecord);
            await updateItems($itemRecord);
            await updateWorlds($worldRecord);
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

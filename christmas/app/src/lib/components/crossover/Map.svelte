<script lang="ts">
    import { cartToIso, seededRandom } from "$lib/crossover/utils";
    import {
        geohashToGridCell,
        gridCellToGeohash,
        type AssetMetadata,
    } from "$lib/crossover/world";
    import { biomeAtGeohash } from "$lib/crossover/world/biomes";
    import { bestiary, biomes } from "$lib/crossover/world/settings";
    import type { Monster, Player } from "$lib/server/crossover/redis/entities";
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
    import { monsterRecord, player } from "../../../store";

    type SpriteLayer = "biome" | "creature" | "prop" | "world";

    const BIOME_ZLAYER = 0;
    const CREATURE_ZLAYER = 10000000000;
    const PROP_ZLAYER = 1000000000;

    let container: HTMLDivElement;
    let prevLocation: string | null = null;
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
    let WORLD_PIVOT_X = (WORLD_WIDTH - CANVAS_WIDTH) / 2;
    let WORLD_PIVOT_Y = (WORLD_HEIGHT - CANVAS_HEIGHT) / 2;
    let GRID_ROWS = CANVAS_ROWS * OVERDRAW_MULTIPLE;
    let GRID_COLS = CANVAS_COLS * OVERDRAW_MULTIPLE;
    let GRID_MID_ROW = Math.floor(GRID_ROWS / 2);
    let GRID_MID_COL = Math.floor(GRID_COLS / 2);

    const app = new Application();
    const worldStage = new Container();

    interface GridSprite {
        id: string;
        sprite: Sprite | Container;
        spriteType: SpriteLayer;
        x: number; // in isometric
        y: number;
        row: number; // in cells
        col: number;
    }
    let gridSprites: Record<string, GridSprite> = {};
    let pivotTarget: { x: number; y: number } = { x: 0, y: 0 };

    $: playerCell = $player && geohashToGridCell($player.location[0]);
    $: playerCell && updateWorld($player);
    $: updateMonsters($monsterRecord);
    $: resize(clientHeight, clientWidth);

    function resize(clientHeight: number, clientWidth: number) {
        if (isInitialized && clientHeight && clientWidth) {
            app.renderer.resize(clientWidth, clientHeight);
            updatePivot();
        }
    }

    async function loadWorld({
        url,
        col,
        row,
    }: {
        url: string;
        col: number;
        row: number;
    }): Promise<Container> {
        const tilemap = await Assets.load(url);
        const tileset = await Assets.load(tilemap.tilesets[0].source);
        const spriteContainer = new Container();

        for (const layer of tilemap.layers) {
            const { data, properties, offsetx, offsety, width, height, x, y } =
                layer;
            const { interior, collider } = groupBy(properties, "name");
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
        const [isoX, isoY] = cartToIso(col * CELL_WIDTH, row * CELL_HEIGHT);
        spriteContainer.x = isoX;
        spriteContainer.y = isoY;
        return spriteContainer;
    }

    async function loadSprite({
        asset,
        col,
        row,
        alpha,
        spriteType,
        variant,
        width,
        height,
        seed,
    }: {
        asset: AssetMetadata;
        col: number;
        row: number;
        alpha: number;
        spriteType: SpriteLayer;
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
            bundle[asset.name]?.textures?.[
                asset.variants?.[variant] || "default"
            ] || bundle[asset.name];
        if (!frame) return null;

        // Creature sprite
        let sprite;

        if (spriteType === "creature") {
            const pedestalBundle = await Assets.loadBundle("pedestals");
            const pedestalTexture =
                pedestalBundle["pedestals"].textures["square_dirt_high"];

            sprite = createCreatureSprite(frame, pedestalTexture);

            // Convert cartesian to isometric position
            const [isoX, isoY] = cartToIso(col * CELL_WIDTH, row * CELL_HEIGHT);
            sprite.x = isoX;
            sprite.y = isoY - CELL_HEIGHT / 4; // isometric cell height is half of cartesian cell height
        } else {
            // TODO: fix biome
            sprite = new Sprite(frame);
            sprite.anchor.set(0.5); // TODO: set anchor in sprite.json not here as each asset is different
            sprite.width = CELL_WIDTH * width; // TODO: remove this scale image to 64 pix per grid
            sprite.height = (frame.height * sprite.width) / frame.width; // maintain aspect ratio

            // Convert cartesian to isometric position
            const [isoX, isoY] = cartToIso(col * CELL_WIDTH, row * CELL_HEIGHT);
            sprite.x = isoX;
            sprite.y = isoY;
        }

        sprite.alpha = alpha;

        return sprite;
    }

    async function updateWorld(p: Player | null) {
        if (!isInitialized || playerCell == null) {
            return;
        }

        // Player
        if (playerSprite != null) {
            const [isoX, isoY] = cartToIso(
                playerCell.col * CELL_HEIGHT,
                playerCell.row * CELL_WIDTH,
            );
            playerSprite.x = isoX;
            playerSprite.y = isoY - CELL_HEIGHT / 4; // isometric cell height is half of cartesian cell height
            playerSprite.zIndex = CREATURE_ZLAYER + playerSprite.y;
        }

        // Move camera to player
        updatePivot();

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
                const geohash = gridCellToGeohash({
                    precision: playerCell.precision,
                    row,
                    col,
                });
                const biome = biomeAtGeohash(geohash);
                const asset = biomes[biome].asset;

                if (asset) {
                    const sprite = await loadSprite({
                        asset,
                        col,
                        row,
                        alpha: 1,
                        spriteType: "biome",
                        seed: (row << 8) + col, // bit shift by 8 else gridRow + gridCol is the same at diagonals
                    });

                    if (sprite) {
                        const biomeId = `biome-${geohash}`;
                        sprite.zIndex = BIOME_ZLAYER + row + col;
                        gridSprites[biomeId] = {
                            id: biomeId,
                            sprite: worldStage.addChild(sprite),
                            spriteType: "biome",
                            x: sprite.x,
                            y: sprite.y,
                            row,
                            col,
                        };
                    }
                }
            }
        }
    }

    async function updateMonsters(mr: Record<string, Monster>) {
        if (!isInitialized || playerCell == null) {
            return;
        }

        for (const m of Object.values(mr)) {
            const { row, col } = geohashToGridCell(m.location[0]);

            // Ignore monsters outside view
            if (
                row > playerCell.row + GRID_MID_ROW ||
                row < playerCell.row - GRID_MID_ROW ||
                col > playerCell.col + GRID_MID_COL ||
                col < playerCell.col - GRID_MID_COL
            ) {
                continue;
            }

            // Update
            if (m.monster in gridSprites) {
                const sprite = gridSprites[m.monster].sprite;
                const [isoX, isoY] = cartToIso(
                    col * CELL_HEIGHT,
                    row * CELL_WIDTH,
                );
                sprite.x = isoX;
                sprite.y = isoY - CELL_HEIGHT / 4; // isometric cell height is half of cartesian cell height
                sprite.zIndex = CREATURE_ZLAYER + sprite.y;
            }
            // Create
            else if (
                row < playerCell.row + GRID_MID_ROW ||
                row > playerCell.row - GRID_MID_ROW ||
                col < playerCell.col + GRID_MID_COL ||
                col > playerCell.col - GRID_MID_COL
            ) {
                const asset = bestiary[m.beast]?.asset;
                if (asset) {
                    const { width, height } = asset;
                    const sprite = await loadSprite({
                        asset,
                        col,
                        row,
                        alpha: 1,
                        width,
                        height,
                        spriteType: "creature",
                    });
                    if (sprite) {
                        sprite.zIndex = CREATURE_ZLAYER + row + col;
                        gridSprites[m.monster] = {
                            id: m.monster,
                            sprite: worldStage.addChild(sprite),
                            spriteType: "creature",
                            x: sprite.x,
                            y: sprite.y,
                            row,
                            col,
                        };
                    }
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

    function updatePivot() {
        if (playerSprite != null) {
            pivotTarget.x = Math.floor(
                playerSprite.x + CELL_WIDTH / 2 - clientWidth / 2,
            );
            pivotTarget.y = playerSprite.y - Math.floor(clientHeight / 2);
        }
    }

    onMount(async () => {
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
        if ($player) {
            await updateWorld($player);
        }
    });
</script>

{#if $player}
    <div
        class={cn("w-full h-full p-0 m-0", $$restProps.class)}
        bind:this={container}
        bind:clientHeight
        bind:clientWidth
    ></div>
{/if}

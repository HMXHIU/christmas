<script lang="ts">
    import { LRUMemoryCache } from "$lib/caches";
    import {
        blueprintsAtTerritoryCache,
        topologyBufferCache,
        topologyResponseCache,
        topologyResultCache,
    } from "$lib/crossover/caches";
    import { crossoverWorldPOI } from "$lib/crossover/client";
    import type { Item } from "$lib/crossover/types";
    import { geohashToColRow } from "$lib/crossover/utils";
    import { topologyAtGeohash } from "$lib/crossover/world/biomes";
    import {
        blueprintsAtTerritory,
        type Templates,
    } from "$lib/crossover/world/blueprint";
    import {
        blueprintOrder,
        blueprints,
    } from "$lib/crossover/world/settings/blueprint";
    import { worldSeed } from "$lib/crossover/world/settings/world";
    import {
        geohashLocationTypes,
        type GeohashLocationType,
    } from "$lib/crossover/world/types";
    import { cn } from "$lib/shadcn";
    import { groupBy, uniqBy } from "lodash-es";
    import {
        Application,
        Assets,
        Geometry,
        Graphics,
        Mesh,
        Shader,
    } from "pixi.js";
    import { onMount } from "svelte";
    import { player } from "../../../../store";
    import { layers } from "../Game/layers";
    import { loadShaderGeometry } from "../shaders";

    interface MapMesh {
        mesh: Mesh<Geometry, Shader>;
        texelX: number;
        texelY: number;
    }

    type PlayerMapPosition = {
        col: number;
        row: number;
        geohash: string;
        mapId: string;
        locationType: GeohashLocationType;
    };

    let containerElement: HTMLDivElement;
    let app: Application | null = null;
    let mapMeshes: Record<string, MapMesh> = {};
    let clientHeight: number;
    let clientWidth: number;
    let playerMapPosition: PlayerMapPosition | null = null;

    // Caches
    const dungeonEntrancesCache = new LRUMemoryCache({ max: 10 });

    $: resize(clientHeight, clientWidth);

    function resize(height: number, width: number) {
        if (app == null || playerMapPosition == null) {
            return;
        }
        app.renderer.resize(width, height);
        updateCamera();
    }

    function updateCamera() {
        if (
            app === null ||
            playerMapPosition === null ||
            mapMeshes[playerMapPosition.mapId] == null
        ) {
            return;
        }

        // Center map on player location (in pixel coordinates)
        const { texelX, texelY } = mapMeshes[playerMapPosition.mapId];
        app.stage.pivot.set(
            playerMapPosition.col * texelX - clientWidth / 2,
            playerMapPosition.row * texelY - clientHeight / 2,
        );
    }

    async function updateMapMesh(geohash: string) {
        const mapId = geohash.slice(0, 2);

        // Map mesh already exists
        if (app === null || mapMeshes[mapId]) {
            return;
        }

        // Convert origin to pixel coordinates
        const { url, width, height, x, y, tile } =
            await topologyAtGeohash(geohash);
        const texelX = width / tile.cols;
        const texelY = height / tile.rows;

        // Load shader and geometry (TODO: possible to create texture from cached png?)
        const texture = await Assets.load(url);
        const parchmentTexture = await Assets.load("/textures/parchment.png");

        const { shader, geometry } = loadShaderGeometry(
            {
                shaderName: "map",
                texture,
                width,
                height,
                ...layers.depthPartition("biome"), // map use biome layer
                geometryUid: mapId,
            },
            {
                textures: {
                    uParchmentTexture: {
                        texture: parchmentTexture,
                        enabled: 1,
                    },
                },
            },
        );

        // Draw the mesh in its location in the world (in pixel coordinates)
        const mesh = new Mesh({ geometry, shader });
        mesh.position.set(tile.origin.col * texelX, tile.origin.row * texelY);

        // Add mesh to stage
        mapMeshes[mapId] = {
            mesh,
            texelX,
            texelY,
        };
        app.stage.addChild(mesh);
    }

    async function updatePOIs(playerMapPosition: PlayerMapPosition) {
        if (!app) {
            return;
        }

        const { texelX, texelY } = mapMeshes[playerMapPosition.mapId];

        // Player sprite
        const p = new Graphics()
            .circle(
                playerMapPosition.col * texelX,
                playerMapPosition.row * texelY,
                3,
            )
            .fill({ color: 0xff0000 });
        app.stage.addChild(p);

        // Dungeon entrance sprites
        const dungeonEntrances = await dungeonEntrancesNeaby(
            playerMapPosition.mapId,
            playerMapPosition.locationType,
        );
        for (const { loc, locT } of dungeonEntrances) {
            const [col, row] = geohashToColRow(loc[0]);
            if (locT === playerMapPosition.locationType) {
                const d = new Graphics()
                    .circle(col * texelX, row * texelY, 3)
                    .fill({ color: 0x00ffff });
                app.stage.addChild(d);
            }
        }

        // Blueprint sprites
        const bps = await blueprintsAtTerritory(
            playerMapPosition.mapId,
            playerMapPosition.locationType,
            blueprints,
            blueprintOrder,
            {
                topologyBufferCache,
                topologyResponseCache,
                topologyResultCache,
                blueprintsAtTerritoryCache,
            },
        );

        const blueprintProps = groupBy(
            Object.entries(bps.props),
            ([loc, p]) => p.blueprint,
        );
        for (const [blueprint, entries] of Object.entries(blueprintProps)) {
            const plotPrecision =
                blueprints[blueprint as Templates].plotPrecision;
            const propLocations = entries.map((xs) => xs[0]);
            const blueprintLocations = uniqBy(propLocations, (l) =>
                l.slice(0, plotPrecision),
            );
            for (const loc of blueprintLocations) {
                const [col, row] = geohashToColRow(loc);
                if ((blueprint as Templates) === "outpost") {
                    const d = new Graphics()
                        .circle(col * texelX, row * texelY, 5)
                        .fill({ color: 0xff00ff });
                    app.stage.addChild(d);
                }
            }
        }
    }

    async function dungeonEntrancesNeaby(
        territory: string,
        locationType: GeohashLocationType,
    ): Promise<Item[]> {
        // Check if in cache
        const cacheKey = `${territory}-${locationType}`;
        const entrances = await dungeonEntrancesCache.get(cacheKey);
        if (entrances) return entrances;

        // Get POIs nearby
        const { dungeonEntrances, territory: t } = await crossoverWorldPOI();
        if (t !== territory) {
            throw new Error(`Cannot retrive POIs (not in territory)`);
        }

        // Set cache
        await dungeonEntrancesCache.set(cacheKey, dungeonEntrances);

        return dungeonEntrances;
    }

    async function init() {
        app = new Application();
        await app.init({
            antialias: false,
            preference: "webgl",
        });
        containerElement.appendChild(app.canvas);
    }

    onMount(() => {
        // Initialize
        init();

        const unsubscribePlayer = player.subscribe(async (p) => {
            if (
                app === null ||
                p === null ||
                !geohashLocationTypes.has(p.locT) ||
                playerMapPosition?.geohash === p.loc[0] // no change in position
            ) {
                return;
            }

            // Recalculate player position
            const [col, row] = geohashToColRow(p.loc[0]);
            playerMapPosition = {
                col,
                row,
                geohash: p.loc[0],
                mapId: p.loc[0].slice(0, worldSeed.spatial.territory.precision),
                locationType: p.locT as GeohashLocationType,
            };

            // Update map mesh
            await updateMapMesh(playerMapPosition.geohash);

            // Update POIs
            await updatePOIs(playerMapPosition);

            // Center map on player location (in pixel coordinates)
            updateCamera();
        });

        return () => {
            unsubscribePlayer();
        };
    });
</script>

<div class="h-full w-full" bind:clientHeight bind:clientWidth>
    <!-- TODO: Add copy button to copy geohash -->
    <!-- <p class="pt-2 text-muted-foreground text-xs text-center">
        {playerMapPosition?.geohash ?? ""}
    </p> -->
    <div
        class={cn("overflow-hidden aspect-square", $$restProps.class)}
        bind:this={containerElement}
    ></div>
</div>

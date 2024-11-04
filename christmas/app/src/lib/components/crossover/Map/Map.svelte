<script lang="ts">
    import { LRUMemoryCache } from "$lib/caches";
    import {
        blueprintsAtLocationCache,
        topologyBufferCache,
        topologyResponseCache,
        topologyResultCache,
    } from "$lib/crossover/caches";
    import { crossoverWorldPOI } from "$lib/crossover/client";
    import { GAME_TEXTURES } from "$lib/crossover/defs";
    import type { Item } from "$lib/crossover/types";
    import { geohashToColRow } from "$lib/crossover/utils";
    import { topologyAtGeohash } from "$lib/crossover/world/biomes";
    import { blueprintsAtTerritory } from "$lib/crossover/world/blueprint";
    import type { BluePrints } from "$lib/crossover/world/blueprint/types";
    import {
        blueprints,
        blueprintsToSpawn,
    } from "$lib/crossover/world/settings/blueprint";
    import { compendium } from "$lib/crossover/world/settings/compendium";
    import { worldSeed } from "$lib/crossover/world/settings/world";
    import {
        geohashLocationTypes,
        type GeohashLocation,
    } from "$lib/crossover/world/types";
    import type { Sanctuary } from "$lib/crossover/world/world";
    import { cn } from "$lib/shadcn";
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
        locationType: GeohashLocation;
    };

    let containerElement: HTMLDivElement;
    let app: Application | null = null;
    let mapMeshes: Record<string, MapMesh> = {};
    let clientHeight: number;
    let clientWidth: number;
    let playerMapPosition: PlayerMapPosition | null = null;

    // Caches
    const poisCache = new LRUMemoryCache({ max: 10 });

    $: resize(clientHeight, clientWidth);

    function resize(height: number, width: number) {
        if (app?.renderer == null || playerMapPosition == null) {
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
        const parchmentTexture = await Assets.load(
            `${GAME_TEXTURES}/parchment.png`,
        );

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

        // Player
        const p = new Graphics()
            .circle(
                playerMapPosition.col * texelX,
                playerMapPosition.row * texelY,
                3,
            )
            .fill({ color: 0xff0000 });
        app.stage.addChild(p);

        // Dungeon entrances (require fetch from server)
        const { dungeonEntrances, sancturaries } = await poisInTerritory(
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

        const bps = await blueprintsAtTerritory(
            playerMapPosition.mapId,
            playerMapPosition.locationType,
            blueprints,
            blueprintsToSpawn,
            {
                topologyBufferCache,
                topologyResponseCache,
                topologyResultCache,
                blueprintsAtLocationCache,
            },
        );

        const towns = new Set<string>();
        const outposts = new Set<string>();
        for (const [geohash, { prop, blueprint }] of Object.entries(
            bps.stencil,
        )) {
            // Monument of control
            if (prop === compendium.control.prop) {
                const [col, row] = geohashToColRow(geohash);
                const d = new Graphics()
                    .circle(col * texelX, row * texelY, 5)
                    .fill({ color: 0xffff00 });
                app.stage.addChild(d);
            }
            // Towns, Outposts
            const precision = blueprints[blueprint as BluePrints].precision;
            if (blueprint === "town") {
                towns.add(geohash.slice(0, precision));
            } else if (blueprint === "outpost") {
                outposts.add(geohash.slice(0, precision));
            }
        }
        for (const geohash of outposts) {
            const [col, row] = geohashToColRow(geohash);
            const d = new Graphics()
                .circle(col * texelX, row * texelY, 5)
                .fill({ color: 0xff00ff });
            app.stage.addChild(d);
        }
        for (const geohash of towns) {
            const [col, row] = geohashToColRow(geohash);
            const d = new Graphics()
                .circle(col * texelX, row * texelY, 5)
                .fill({ color: 0xff00ff });
            app.stage.addChild(d);
        }

        // Sanctuaries
        for (const { geohash } of sancturaries) {
            const [col, row] = geohashToColRow(geohash);
            const d = new Graphics()
                .circle(col * texelX, row * texelY, 5)
                .fill({ color: 0xfff0ff });
            app.stage.addChild(d);
        }
    }

    async function poisInTerritory(
        territory: string,
        locationType: GeohashLocation,
    ): Promise<{
        sancturaries: Sanctuary[];
        dungeonEntrances: Item[];
        territory: string;
    }> {
        // Check if in cache
        const cacheKey = `${territory}-${locationType}`;
        const entrances = await poisCache.get(cacheKey);
        if (entrances) return entrances;

        // Get POIs nearby
        const pois = await crossoverWorldPOI();

        // Set cache
        await poisCache.set(cacheKey, pois);

        return pois;
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
                locationType: p.locT as GeohashLocation,
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

<div
    class={cn("overflow-hidden aspect-square", $$restProps.class)}
    bind:clientHeight
    bind:clientWidth
>
    <div bind:this={containerElement}></div>
</div>

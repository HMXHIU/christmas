<script lang="ts">
    import { geohashToColRow } from "$lib/crossover/utils";
    import { topologyAtGeohash } from "$lib/crossover/world/biomes";
    import { cn } from "$lib/shadcn";
    import { Application, Assets, Geometry, Mesh, Shader } from "pixi.js";
    import { onDestroy, onMount } from "svelte";
    import { player } from "../../../../store";
    import { initAssetManager } from "../Game/utils";
    import { loadShaderGeometry } from "../shaders";

    interface MapMesh {
        mesh: Mesh<Geometry, Shader>;
        texelX: number;
        texelY: number;
    }

    let containerElement: HTMLDivElement;
    let app: Application | null = null;
    let geohash: string | null = null;
    let mapMeshes: Record<string, MapMesh> = {};
    let clientHeight: number;
    let clientWidth: number;

    $: resize(clientHeight, clientWidth);

    function resize(height: number, width: number) {
        if (app == null || geohash == null) {
            return;
        }

        console.log("resize", width, height);
        app.renderer.resize(width, height);
        updateCamera(geohash);
    }
    function updateCamera(geohash: string) {
        if (app === null) {
            return;
        }
        // Center map on player location (in pixel coordinates)
        const mapId = geohash.slice(0, 2);
        if (mapMeshes[mapId] == null) {
            return;
        }
        const { texelX, texelY } = mapMeshes[mapId];
        const [col, row] = geohashToColRow(geohash);
        app.stage.pivot.set(
            col * texelX - clientWidth / 2,
            row * texelY - clientHeight / 2,
        );
        console.log(col * texelX, row * texelY);
    }

    async function init() {
        app = new Application();
        await initAssetManager();
        await app.init({
            antialias: false,
            preference: "webgl",
        });
        containerElement.appendChild(app.canvas);
    }

    async function updateMapMesh(geohash: string) {
        if (app === null) {
            return;
        }

        const mapId = geohash.slice(0, 2);

        // Check if map mesh already exists
        if (mapMeshes[mapId]) {
            return;
        }

        const { url, width, height, x, y, tile } =
            await topologyAtGeohash(geohash);

        // Convert origin to pixel coordinates
        const texelX = width / tile.cols;
        const texelY = height / tile.rows;

        // Load shader and geometry (TODO: possible to create texture from cached png?)
        const texture = await Assets.load(url);
        const { shader, geometry } = loadShaderGeometry(
            "map",
            texture,
            width,
            height,
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

    onMount(() => {
        // Initialize
        init();

        const unsubscribePlayer = player.subscribe(async (p) => {
            if (app === null || p === null || p.locT !== "geohash") {
                return;
            }

            // Check if player location has changed
            if (geohash === p.loc[0]) {
                return;
            }

            geohash = p.loc[0];

            // Update map mesh
            await updateMapMesh(geohash);

            // Center map on player location (in pixel coordinates)
            updateCamera(geohash);
        });

        return () => {
            unsubscribePlayer();
        };
    });

    onDestroy(() => {
        if (app !== null) {
            app.stage.removeAllListeners();
            app = null;
        }
    });
</script>

<div class="h-full w-full" bind:clientHeight bind:clientWidth>
    <div
        id="map-container"
        class={cn(
            "rounded-full overflow-hidden aspect-square",
            $$restProps.class,
        )}
        bind:this={containerElement}
    ></div>
    <!-- TODO: Add copy button to copy geohash -->
    <p class="pt-2 text-muted-foreground text-xs text-center">
        {geohash ?? ""}
    </p>
</div>

<style>
    #map-container {
        border-radius: 50%;
        border: 2px solid #000000; /* Adjust color and width as needed */
        box-shadow: 0 0 0 2px #6c6c6c; /* Optional: adds a white outline outside the black border */
    }
</style>

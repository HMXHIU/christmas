<script lang="ts">
    import { crossoverPlayerMetadata } from "$lib/crossover/client";
    import { type GameCommand } from "$lib/crossover/ir";
    import { getPlayerAbilities } from "$lib/crossover/world/abilities";
    import { actions } from "$lib/crossover/world/settings/actions";
    import { compendium } from "$lib/crossover/world/settings/compendium";
    import { worldSeed } from "$lib/crossover/world/settings/world";
    import { getGameTime } from "$lib/crossover/world/world";
    import { cn } from "$lib/shadcn";
    import gsap from "gsap";
    import {
        Application,
        Container,
        FederatedPointerEvent,
        Ticker,
        WebGLRenderer,
    } from "pixi.js";
    import { onDestroy, onMount } from "svelte";
    import {
        calibrateWorldOffset,
        tryExecuteGameCommand,
        updateEntities,
    } from ".";
    import type { ActionEvent } from "../../../../routes/api/crossover/stream/+server";
    import {
        actionEvent,
        ctaEvent,
        ctaRecord,
        entitiesEvent,
        itemRecord,
        loginEvent,
        monsterRecord,
        player,
        playerAbilities,
        playerRecord,
        target,
        userMetadata,
        worldOffset,
    } from "../../../../store";
    import {
        clearInstancedShaderMeshes,
        destroyShaders,
        updateShaderUniforms,
    } from "../shaders";
    import { AmbientOverlay } from "../shaders/ambient";
    import { animateAbility } from "./animations";
    import { drawBiomeShaders } from "./biomes";
    import {
        cullAllEntityContainers,
        entityContainers,
        entitySigils,
    } from "./entities";
    import { createHIDHandlers } from "./hid";
    import {
        CANVAS_HEIGHT,
        CANVAS_WIDTH,
        CELL_WIDTH,
        OVERDRAW_HEIGHT,
        OVERDRAW_WIDTH,
    } from "./settings";
    import { displayCommandPreview, displayTargetBox } from "./ui";
    import {
        getPlayerEC,
        getPlayerPosition,
        registerGSAP,
        type Position,
    } from "./utils";
    import { drawWorldsAtLocation } from "./world";

    // Register GSAP & PixiPlugin
    registerGSAP();

    export let previewCommand: GameCommand | null = null;

    let container: HTMLDivElement;
    let isInitialized = false;
    let clientWidth: number;
    let clientHeight: number;
    let app: Application | null = null;
    let worldStage: Container | null = null;
    let cameraTween: gsap.core.Tween | null = null;

    let ambientOverlay: AmbientOverlay | null = null;

    let mouseMove: (e: FederatedPointerEvent) => void;
    let mouseDown: (e: FederatedPointerEvent) => void;
    let mouseUp: (e: FederatedPointerEvent) => void;

    $: resize(clientHeight, clientWidth);
    $: handlePreviewCommand(previewCommand);

    async function handlePreviewCommand(command: GameCommand | null) {
        if (!isInitialized || !worldStage || !app || !$player) {
            return;
        }
        const playerPosition = getPlayerPosition();
        if (!playerPosition) return;
        await displayCommandPreview({
            command,
            player: $player,
            playerPosition,
            target: $target,
            stage: worldStage,
        });
    }

    function resize(clientHeight: number, clientWidth: number) {
        if (app && isInitialized && clientHeight && clientWidth && $player) {
            app.renderer.resize(clientWidth, clientHeight);
            // Camera track the player
            const position = getPlayerPosition();
            if (position != null) {
                cameraTrackPosition(position, 1);
            }
        }
    }

    async function drawActionEvent(event: ActionEvent) {
        /**
         * TODO: Server should notify entity perform action on entity to all clients involved for rendering
         */
        if (!isInitialized || worldStage == null) {
            return;
        }
        const { source, target, action, ability, utility, prop } = event;

        // Get source entity
        const sourceEntity = entityContainers[source];
        const targetEntity = target ? entityContainers[target] : null;

        // Render action/ability/utility
        if (action != null && sourceEntity != null) {
            await sourceEntity.triggerAnimation(action);
        } else if (ability != null) {
            await animateAbility(worldStage, {
                source: sourceEntity,
                target: targetEntity ?? undefined,
                ability,
            });
        } else if (
            utility != null &&
            prop != null &&
            compendium[prop]?.utilities[utility] != null
        ) {
            const utilityRecord = compendium[prop]?.utilities[utility];
        }
    }

    function ticker(ticker: Ticker) {
        if (!isInitialized || app == null || worldStage == null) {
            return;
        }

        // Clear depth buffer
        const gl = (app.renderer as WebGLRenderer).gl;
        gl.clearDepth(1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Update shader uniforms
        const seconds = ticker.elapsedMS / 1000;
        updateShaderUniforms({ deltaTime: seconds });

        // Animate sigils
        for (const sigil of Object.values(entitySigils)) {
            sigil.render();
        }

        // Update lights
        if (ambientOverlay) {
            const ec = getPlayerEC();
            if (ec) {
                const perceiver = { x: ec.x, y: ec.y, intensity: 0.6 };
                const lights = [perceiver];

                // Update ambient (darkness, rain, snow etc ...)
                ambientOverlay.position.set(
                    ec.x - OVERDRAW_WIDTH / 2,
                    ec.y - OVERDRAW_HEIGHT / 2,
                );
                ambientOverlay.updateLights(
                    lights,
                    getAmbientLightValue(),
                    perceiver,
                );

                // Update normal maps
                for (const ec of Object.values(entityContainers)) {
                    ec.updateNormalMaps(lights);
                }
            }
        }
    }

    function getAmbientLightValue(): number {
        const { hour } = getGameTime(worldSeed);
        // Night (0:00 - 5:59): Darkest
        if (hour >= 0 && hour < 6) {
            return 0.1;
        }

        // Dawn (6:00 - 7:59): Light gradually increasing
        if (hour >= 6 && hour < 8) {
            return 0.3 + (hour - 6) * 0.3; // Gradually increases from 0.3 to 0.9
        }

        // Full daylight (8:00 - 16:59)
        if (hour >= 8 && hour < 17) {
            return 1.0;
        }

        // Dusk (17:00 - 18:59): Light gradually decreasing
        if (hour >= 17 && hour < 19) {
            return 0.9 - (hour - 17) * 0.3; // Gradually decreases from 0.9 to 0.3
        }

        // Evening/Night (19:00 - 23:59): Darkest
        return 0.15;
    }

    function cameraTrackPosition(position: Position, duration?: number) {
        if (!worldStage) return;

        // Camera track the player
        const cameraX = position.isoX + CELL_WIDTH / 2 - clientWidth / 2;
        const cameraY = position.isoY - position.elevation - clientHeight / 2;
        if (duration != null) {
            cameraTween = gsap.to(worldStage.pivot, {
                x: cameraX,
                y: cameraY,
                duration: duration * 3,
                ease: "power2.inout",
                overwrite: true, // overwrite previous tweens
            });
        } else {
            worldStage.pivot = { x: cameraX, y: cameraY };
        }
    }

    /**
     * This is called for each geohash position change (unused)
     */
    export async function handlePlayerPositionUpdate(
        oldPosition: Position | null,
        newPosition: Position,
    ) {}

    /**
     * This is called once entity reaches destination
     */
    export async function handleTrackPlayer({
        startPosition,
        position,
        duration,
    }: {
        startPosition: Position | null;
        position: Position;
        duration?: number;
    }) {
        if (!worldStage) return;

        // Update biomes
        await drawBiomeShaders(position, worldStage);

        // Camera track the player
        cameraTrackPosition(position, duration);

        // Reload the game (if strayed to far off the `worldOfffset`)
        const maxDistance = 15000;
        if (
            Math.abs($worldOffset.col - position.col) > maxDistance ||
            Math.abs($worldOffset.row - position.row) > maxDistance
        ) {
            // Recalibrate worldOffset (this affects cartToIso & isoToCart)
            calibrateWorldOffset(position.geohash);
            // Relook surrounding entities
            if ($player) {
                await tryExecuteGameCommand([actions.look, { self: $player }]);
            }
        }
        // Relook surrounding entities if enter a new location
        else if (
            !startPosition ||
            startPosition.locationType !== position.locationType ||
            startPosition.locationInstance !== position.locationInstance
        ) {
            if ($player) {
                await tryExecuteGameCommand([actions.look, { self: $player }]);
            }
        }

        // Update worlds
        await drawWorldsAtLocation(position, worldStage);
    }

    /*
     * Initialization
     */
    async function init() {
        if (isInitialized) {
            console.warn("Game already initialized");
            return;
        }

        app = new Application();
        worldStage = new Container();
        worldStage.sortableChildren = true;
        app.stage.addChild(worldStage);

        await app.init({
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            preference: "webgl",
            antialias: true,
            // roundPixels: true,
            autoDensity: true,
        });

        // Set up depth test
        const gl = (app.renderer as WebGLRenderer).gl;
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.depthMask(true);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Setup app events
        app.stage.eventMode = "static"; // enable interactivity
        app.stage.hitArea = app.screen; // ensure whole canvas area is interactive

        // Listen to HID events
        app.stage.off("pointerup", mouseUp);
        app.stage.off("pointerdown", mouseDown);
        app.stage.off("pointermove", mouseMove);
        ({ mouseMove, mouseUp, mouseDown } = createHIDHandlers(worldStage));
        app.stage.on("pointerup", mouseUp);
        app.stage.on("pointerdown", mouseDown);
        app.stage.on("pointermove", mouseMove);

        // Add ticker
        app.ticker.add(ticker);

        // Add the canvas to the DOM
        container.appendChild(app.canvas);

        // Set initialized
        isInitialized = true;

        // Resize the canvas
        resize(clientHeight, clientWidth);

        // Initial HMR update (stores are already initialized)
        if ($player) {
            await updateEntities(
                {
                    players: Object.values($playerRecord),
                    items: Object.values($itemRecord),
                    monsters: Object.values($monsterRecord),
                    op: "replace",
                },
                {
                    app,
                    stage: worldStage,
                    handlePlayerPositionUpdate,
                    handleTrackPlayer,
                },
            );
        }

        // Set the ambient overlay (darkness, clouds, snow, rain, etc...)
        ambientOverlay = new AmbientOverlay({
            width: OVERDRAW_WIDTH,
            height: OVERDRAW_HEIGHT,
        });
        worldStage.addChild(ambientOverlay);
    }

    onMount(() => {
        // Initialize game
        init();

        // Store subscriptions
        const subscriptions = [
            loginEvent.subscribe(async (p) => {
                if (!p) return;

                // Calibrate worldOffset
                calibrateWorldOffset(p.loc[0]);

                // Fetch player metadata
                userMetadata.set(await crossoverPlayerMetadata());

                // Fetch player abilities
                playerAbilities.set(getPlayerAbilities(p));

                // Look at surroundings & update inventory
                await tryExecuteGameCommand([actions.look, { self: p }]);
                await tryExecuteGameCommand([actions.inventory, { self: p }]);
            }),
            ctaEvent.subscribe((e) => {
                if (!e) return;
                ctaRecord.update((r) => {
                    r[e.cta.pin] = e.cta;
                    return r;
                });
            }),
            actionEvent.subscribe(async (e) => {
                if (!e) return;
                await drawActionEvent(e);
            }),
            entitiesEvent.subscribe(async (e) => {
                if (!e || !worldStage || !app || !$player) return;
                await updateEntities(e, {
                    app: app,
                    stage: worldStage,
                    handlePlayerPositionUpdate,
                    handleTrackPlayer,
                });
            }),
            target.subscribe((t) => {
                if ($player == null || worldStage == null) {
                    return;
                }
                displayTargetBox(t);
            }),
        ];

        return () => {
            for (const unsubscribe of subscriptions) {
                unsubscribe();
            }
        };
    });

    function stopTweens() {
        if (cameraTween) {
            cameraTween.kill();
        }
    }

    onDestroy(() => {
        if (app && worldStage) {
            isInitialized = false; // set this so ticker stops before removing other things

            // Stop tweens
            stopTweens();

            // Remove HID events
            app.stage.off("pointerup", mouseUp);
            app.stage.off("pointerdown", mouseDown);
            app.stage.off("pointermove", mouseMove);

            // Destroy all children
            for (const child of worldStage.children) {
                child.destroy();
            }

            // Destroy shaders
            clearInstancedShaderMeshes();
            destroyShaders();

            // Destroy all ecs
            cullAllEntityContainers();
        }
    });
</script>

<div
    class={cn("w-full h-full p-0 m-0", $$restProps.class)}
    bind:this={container}
    bind:clientHeight
    bind:clientWidth
></div>

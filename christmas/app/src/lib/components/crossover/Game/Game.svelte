<script lang="ts">
    import { crossoverPlayerMetadata } from "$lib/crossover/client";
    import { getGameActionId, type GameCommand } from "$lib/crossover/ir";
    import { getEntityId, getPositionsForPath } from "$lib/crossover/utils";
    import {
        getPlayerAbilities,
        type Ability,
    } from "$lib/crossover/world/abilities";
    import { actions, type Action } from "$lib/crossover/world/actions";
    import { compendium, type Utility } from "$lib/crossover/world/compendium";
    import { cn } from "$lib/shadcn";
    import { gsap } from "gsap";
    import {
        Application,
        Container,
        FederatedPointerEvent,
        Ticker,
        WebGLRenderer,
    } from "pixi.js";
    import { onDestroy, onMount } from "svelte";
    import { executeGameCommand, updateEntities, updateWorlds } from ".";
    import type { ActionEvent } from "../../../../routes/api/crossover/stream/+server";
    import {
        actionEvent,
        entitiesEvent,
        itemRecord,
        loginEvent,
        monsterRecord,
        player,
        playerAbilities,
        playerRecord,
        target,
        userMetadata,
        worldRecord,
    } from "../../../../store";
    import {
        clearInstancedShaderMeshes,
        destroyShaders,
        highlightShaderInstances,
        updateShaderUniforms,
    } from "../shaders";
    import { animateAbility } from "./animations";
    import { drawBiomeShaders } from "./biomes";
    import {
        cullAllEntityContainers,
        entityContainers,
        garbageCollectEntityContainers,
    } from "./entities";
    import { createHIDHandlers } from "./hid";
    import { drawTargetUI } from "./ui";
    import {
        CANVAS_HEIGHT,
        CANVAS_WIDTH,
        CELL_WIDTH,
        getDirectionsToPosition,
        getPathHighlights,
        getPlayerPosition,
        initAssetManager,
        positionsInRange,
        registerGSAP,
        type Position,
    } from "./utils";
    import { cullWorlds, drawWorlds } from "./world";

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

    let mouseMove: (e: FederatedPointerEvent) => void;
    let mouseDown: (e: FederatedPointerEvent) => void;
    let mouseUp: (e: FederatedPointerEvent) => void;

    $: resize(clientHeight, clientWidth);
    $: handlePreviewCommand(previewCommand);

    async function handlePreviewCommand(command: GameCommand | null) {
        if (
            !isInitialized ||
            worldStage == null ||
            app == null ||
            $player == null
        ) {
            return;
        }
        if (command == null) {
            // Clear highlights
            highlightShaderInstances("biome", {});
            return;
        }

        const [ga, { self, target: commandTarget, item }] = command;
        const [gaId, gaType] = getGameActionId(ga);

        // Highlight target (prevent commandTarget from overriding target)
        drawTargetUI({
            target: $target,
            highlight: 2,
            stage: worldStage,
            source: $player,
        });

        if (commandTarget != null) {
            const [commandTargetId, commandTargetType] =
                getEntityId(commandTarget);
            const targetEC = entityContainers[commandTargetId];

            if (targetEC == null) {
                return;
            }

            // Highlight command target
            drawTargetUI({
                target: commandTarget,
                highlight: 3,
                stage: worldStage,
                source: $player,
            });

            const playerPosition = getPlayerPosition();
            if (playerPosition == null) {
                return;
            } else if (gaType === "ability" && targetEC.isoPosition != null) {
                const ability = ga as Ability;

                // Get movement required to get in range
                const path = getDirectionsToPosition(
                    playerPosition,
                    targetEC.isoPosition,
                    ability.range,
                );
                const pathPositions = getPositionsForPath(playerPosition, path);
                const destination = pathPositions[pathPositions.length - 1];

                // Get path highlights
                const pathHighlights = getPathHighlights(pathPositions, 1);
                highlightShaderInstances("biome", pathHighlights);

                // Get cells in range highlights
                const rangeCellsHighlights = positionsInRange(
                    ability,
                    destination,
                );
                highlightShaderInstances("biome", {
                    ...rangeCellsHighlights,
                    ...pathHighlights,
                });
            } else if (gaType === "utility") {
                const utility = ga as Utility;
            } else if (gaType === "action") {
                const action = ga as Action;
                // Highlight cells in range
                highlightShaderInstances(
                    "biome",
                    positionsInRange(action, playerPosition),
                );
            }
        }
    }

    function resize(clientHeight: number, clientWidth: number) {
        if (app && isInitialized && clientHeight && clientWidth && $player) {
            app.renderer.resize(clientWidth, clientHeight);
            const position = getPlayerPosition();
            if (position != null) {
                handleTrackPlayer({ position, duration: 1 });
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
    }

    export async function handlePlayerPositionUpdate(position: Position) {
        if (worldStage == null) {
            return;
        }

        // Update biomes
        await drawBiomeShaders(position, worldStage);

        // Cull entity meshes outside view
        garbageCollectEntityContainers(position);

        // Cull world meshes outside town
        cullWorlds(position);
    }

    export async function handleTrackPlayer({
        position,
        duration,
    }: {
        position: Position;
        duration?: number;
    }) {
        if (worldStage == null) {
            return;
        }
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
            updateEntities(
                {
                    players: Object.values($playerRecord),
                    items: Object.values($itemRecord),
                    monsters: Object.values($monsterRecord),
                    op: "replace",
                },
                {
                    stage: worldStage,
                    handlePlayerPositionUpdate,
                    handleTrackPlayer,
                },
            );
            await drawWorlds($worldRecord, worldStage);
        }
    }

    onMount(() => {
        // Initialize game
        init();

        // Store subscriptions
        const subscriptions = [
            loginEvent.subscribe(async (p) => {
                if (!p) return;
                // Fetch player metadata
                userMetadata.set(await crossoverPlayerMetadata());
                // Fetch player abilities
                playerAbilities.set(getPlayerAbilities(p));
                // Look at surroundings & update inventory
                await updateWorlds(p.loc[0]);
                await executeGameCommand([actions.look, { self: p }]);
                await executeGameCommand([actions.inventory, { self: p }]);
            }),
            actionEvent.subscribe(async (e) => {
                if (!e) return;
                await drawActionEvent(e);
            }),
            entitiesEvent.subscribe(async (e) => {
                if (!e || !worldStage) return;
                await updateEntities(e, {
                    stage: worldStage,
                    handlePlayerPositionUpdate,
                    handleTrackPlayer,
                });
            }),
            worldRecord.subscribe((wr) => {
                if (worldStage != null) {
                    drawWorlds(wr, worldStage);
                }
            }),
            target.subscribe((t) => {
                if ($player == null || worldStage == null) {
                    return;
                }
                drawTargetUI({
                    target: t,
                    highlight: 2,
                    source: $player,
                    stage: worldStage!,
                });
            }),
        ];

        return () => {
            for (const unsubscribe of subscriptions) {
                unsubscribe();
            }
        };
    });

    onDestroy(() => {
        if (app && worldStage) {
            isInitialized = false; // set this so ticker stops before removing other things

            // Stop tweens
            if (cameraTween) {
                cameraTween.kill();
            }

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

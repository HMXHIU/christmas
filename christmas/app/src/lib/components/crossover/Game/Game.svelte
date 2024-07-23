<script lang="ts">
    import { crossoverCmdMove } from "$lib/crossover";
    import { getGameActionId, type GameCommand } from "$lib/crossover/ir";
    import {
        getEntityId,
        getPositionsForPath,
        snapToGrid,
    } from "$lib/crossover/utils";
    import { type Ability } from "$lib/crossover/world/abilities";
    import { type Action } from "$lib/crossover/world/actions";
    import {
        EquipmentSlots,
        compendium,
        type EquipmentSlot,
        type Utility,
    } from "$lib/crossover/world/compendium";
    import type { Direction } from "$lib/crossover/world/types";
    import type { Player } from "$lib/server/crossover/redis/entities";
    import { cn } from "$lib/shadcn";
    import { AsyncLock } from "$lib/utils";
    import { gsap } from "gsap";
    import {
        Application,
        Container,
        FederatedMouseEvent,
        Ticker,
        WebGLRenderer,
    } from "pixi.js";
    import { onDestroy, onMount } from "svelte";
    import type { ActionEvent } from "../../../../routes/api/crossover/stream/+server";
    import {
        itemRecord,
        monsterRecord,
        player,
        playerEquippedItems,
        playerInventoryItems,
        playerRecord,
        target,
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
        cullEntityContainers,
        entityContainers,
        updateEntities,
        upsertEntityContainer,
    } from "./entities";
    import { drawTargetUI } from "./ui";
    import {
        CANVAS_HEIGHT,
        CANVAS_WIDTH,
        CELL_WIDTH,
        HALF_ISO_CELL_HEIGHT,
        HALF_ISO_CELL_WIDTH,
        calculateRowColFromIso,
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
    let lastCursorX: number = 0;
    let lastCursorY: number = 0;
    let isMouseDown: boolean = false;
    let path: Direction[] | null = null;
    let cameraTween: gsap.core.Tween | null = null;
    let playerIsoX: number = 0;
    let playerIsoY: number = 0;

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

    export async function drawActionEvent(event: ActionEvent) {
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

    function onMouseMove(x: number, y: number) {
        const playerPosition = getPlayerPosition();
        if (playerPosition == null) {
            return;
        } else if (isMouseDown) {
            // Calculate path (astar)
            const [rowEnd, colEnd] = calculateRowColFromIso(x, y);
            path = getDirectionsToPosition(playerPosition, {
                row: rowEnd,
                col: colEnd,
            });
            const pathPositions = getPositionsForPath(playerPosition, path);
            highlightShaderInstances(
                "biome",
                getPathHighlights(pathPositions, 1),
            );
        }
    }

    async function onMouseUp(x: number, y: number) {
        const playerPosition = getPlayerPosition();
        if (playerPosition == null) {
            return;
        }
        // Clear highlights
        highlightShaderInstances("biome", {});

        // Move command
        if (path != null && path.length > 0) {
            await crossoverCmdMove({ path }); // TODO: should funnel everything through executeGameCommand
        }
    }

    function onMouseDown(x: number, y: number) {
        // Clear path
        path = null;
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

    async function handlePlayerPositionUpdate(position: Position) {
        if (worldStage == null) {
            return;
        }

        // Update biomes
        await drawBiomeShaders(position, worldStage);

        // Cull entity meshes outside view
        cullEntityContainers(position);

        // Cull world meshes outside town
        cullWorlds(position);
    }

    async function handleTrackPlayer({
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

    const playerPositionUpdateLock = new AsyncLock();
    async function updatePlayer(player: Player | null) {
        playerPositionUpdateLock.withLock(async () => {
            if (!isInitialized || worldStage == null || player == null) {
                return;
            }

            // Upsert player container
            const [created, ec] = await upsertEntityContainer(
                player,
                worldStage,
            );

            // Listen on position update
            if (created) {
                ec.on("positionUpdate", handlePlayerPositionUpdate);
                ec.on("trackEntity", handleTrackPlayer);
                // First position update is not handled
                if (ec.isoPosition != null) {
                    await handlePlayerPositionUpdate(ec.isoPosition);
                    await handleTrackPlayer({ position: ec.isoPosition });
                }
            }
        });
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

        function getMousePosition(
            e: FederatedMouseEvent,
        ): [number, number] | null {
            const playerPosition = getPlayerPosition();
            if (playerPosition == null) {
                return null;
            }
            return snapToGrid(
                e.global.x + worldStage!.pivot.x,
                e.global.y + worldStage!.pivot.y + playerPosition.elevation, // select on the same plane as player
                HALF_ISO_CELL_WIDTH,
                HALF_ISO_CELL_HEIGHT,
            );
        }
        app.stage.onmouseup = (e) => {
            const playerPosition = getPlayerPosition();
            if (playerPosition != null && e.global != null) {
                const snapXY = getMousePosition(e);
                if (snapXY != null) {
                    onMouseUp(...snapXY);
                    lastCursorX = snapXY[0];
                    lastCursorY = snapXY[1];
                    isMouseDown = false;
                }
            }
        };
        app.stage.onmousedown = (e) => {
            if (e.global != null) {
                const snapXY = getMousePosition(e);
                if (snapXY != null) {
                    onMouseDown(...snapXY);
                    lastCursorX = snapXY[0];
                    lastCursorY = snapXY[1];
                    isMouseDown = true;
                }
            }
        };
        app.stage.onmousemove = (e) => {
            if (e.global != null) {
                const snapXY = getMousePosition(e);
                if (
                    snapXY != null &&
                    (lastCursorX !== snapXY[0] || lastCursorY !== snapXY[1])
                ) {
                    onMouseMove(...snapXY);
                    lastCursorX = snapXY[0];
                    lastCursorY = snapXY[1];
                }
            }
        };

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
            await updatePlayer($player);
            await updateEntities($monsterRecord, "monster", worldStage);
            await updateEntities($playerRecord, "player", worldStage);
            await updateEntities($itemRecord, "item", worldStage);
            await drawWorlds($worldRecord, worldStage);

            const position = await getPlayerPosition();
            if (position != null) {
                // ec.on("positionUpdate", handlePlayerPositionUpdate);
                // ec.on("trackEntity", handleTrackPlayer);

                await handlePlayerPositionUpdate(position);
                await handleTrackPlayer({ position });
            }
        }
    }

    onMount(() => {
        // Initialize game
        init();

        // Store subscriptions
        const subscriptions = [
            monsterRecord.subscribe((mr) => {
                if (worldStage == null) {
                    return;
                }
                updateEntities(mr, "monster", worldStage);
            }),
            playerRecord.subscribe((pr) => {
                if (worldStage == null) {
                    return;
                }
                updateEntities(pr, "player", worldStage);
            }),
            itemRecord.subscribe((ir) => {
                if (worldStage == null) {
                    return;
                }
                updateEntities(ir, "item", worldStage);

                // Player inventory and equipped items
                const playerItems = Object.values(ir).filter((item) => {
                    return (
                        item.loc.length === 1 && item.loc[0] === $player?.player
                    );
                });
                playerInventoryItems.set(
                    playerItems.filter((item) => {
                        return item.locT === "inv";
                    }),
                );
                playerEquippedItems.set(
                    playerItems.filter((item) => {
                        return EquipmentSlots.includes(
                            item.locT as EquipmentSlot,
                        );
                    }),
                );
            }),
            worldRecord.subscribe((wr) => {
                if (worldStage != null) {
                    drawWorlds(wr, worldStage);
                }
            }),
            player.subscribe((p) => {
                updatePlayer(p);
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

            // Destroy all children
            for (const child of worldStage.children) {
                child.destroy();
            }

            // Destroy shaders
            clearInstancedShaderMeshes();
            destroyShaders();

            // Destroy all ecs
            cullEntityContainers();
        }
    });
</script>

<div
    class={cn("w-full h-full p-0 m-0", $$restProps.class)}
    bind:this={container}
    bind:clientHeight
    bind:clientWidth
></div>

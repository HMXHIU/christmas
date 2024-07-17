<script lang="ts">
    import { crossoverCmdMove } from "$lib/crossover";
    import { getGameActionId, type GameCommand } from "$lib/crossover/ir";
    import {
        getEntityId,
        getPositionsForPath,
        snapToGrid,
    } from "$lib/crossover/utils";
    import { type Ability } from "$lib/crossover/world/abilities";
    import { actions, type Action } from "$lib/crossover/world/actions";
    import {
        EquipmentSlots,
        compendium,
        type EquipmentSlot,
        type Utility,
    } from "$lib/crossover/world/compendium";
    import { MS_PER_TICK } from "$lib/crossover/world/settings";
    import type { Direction } from "$lib/crossover/world/types";
    import type { Player } from "$lib/server/crossover/redis/entities";
    import { cn } from "$lib/shadcn";
    import { gsap } from "gsap";
    import PixiPlugin from "gsap/PixiPlugin";
    import {
        Application,
        Assets,
        Container,
        FederatedMouseEvent,
        Texture,
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
        cullEntityMeshes,
        entityMeshes,
        updateEntities,
        upsertEntityMesh,
    } from "./entities";
    import { drawTargetUI } from "./ui";
    import {
        CANVAS_HEIGHT,
        CANVAS_WIDTH,
        CELL_WIDTH,
        HALF_ISO_CELL_HEIGHT,
        HALF_ISO_CELL_WIDTH,
        WORLD_HEIGHT,
        WORLD_WIDTH,
        calculatePosition,
        calculateRowColFromIso,
        getDirectionsToPosition,
        getPathHighlights,
        initAssetManager,
        positionsInRange,
        updateEntityMeshRenderOrder,
        type Position,
    } from "./utils";
    import { cullWorlds, drawWorlds } from "./world";

    export let previewCommand: GameCommand | null = null;

    let container: HTMLDivElement;
    let isInitialized = false;
    let clientWidth: number;
    let clientHeight: number;
    let app: Application | null = null;
    let worldStage: Container | null = null;
    let playerPosition: Position | null = null;
    let lastCursorX: number = 0;
    let lastCursorY: number = 0;
    let isMouseDown: boolean = false;
    let path: Direction[] | null = null;

    $: handlePlayerPosition(playerPosition);
    $: resize(clientHeight, clientWidth);
    $: handlePreviewCommand(previewCommand);

    async function handlePreviewCommand(command: GameCommand | null) {
        if (
            !isInitialized ||
            playerPosition == null ||
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
            entityMeshes,
            highlight: 2,
            stage: worldStage,
            source: $player,
        });

        if (commandTarget != null) {
            const [commandTargetId, commandTargetType] =
                getEntityId(commandTarget);
            const commandTargetEntityMesh = entityMeshes[commandTargetId];

            if (commandTargetEntityMesh == null) {
                return;
            }

            // Highlight command target
            drawTargetUI({
                target: commandTarget,
                entityMeshes,
                highlight: 3,
                stage: worldStage,
                source: $player,
            });

            if (gaType === "ability") {
                const ability = ga as Ability;

                // Get movement required to get in range
                const path = getDirectionsToPosition(
                    playerPosition,
                    entityMeshes[commandTargetId].position,
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

    function updatePlayerPosition(player: Player | null) {
        if (player == null) {
            return;
        }
        calculatePosition(player.loc[0]).then((p) => {
            playerPosition = p;
        });
    }

    function updateCamera(player: Player, tween = true) {
        if (playerPosition != null && worldStage != null) {
            const offsetX =
                playerPosition.isoX + CELL_WIDTH / 2 - clientWidth / 2;
            const offsetY =
                playerPosition.isoY -
                playerPosition.elevation -
                clientHeight / 2;
            if (tween) {
                const t = gsap.to(worldStage.pivot, {
                    x: offsetX,
                    y: offsetY,
                    duration: 1,
                    ease: "power2.out",
                    overwrite: true, // overwrite previous tweens
                });
            } else {
                worldStage.pivot = { x: offsetX, y: offsetY };
            }
        }
    }

    function resize(clientHeight: number, clientWidth: number) {
        if (app && isInitialized && clientHeight && clientWidth && $player) {
            app.renderer.resize(clientWidth, clientHeight);
            updateCamera($player);
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
        const sourceEntity = entityMeshes[source];
        const targetEntity = target ? entityMeshes[target] : null;

        // Render action/ability/utility
        if (action != null && sourceEntity != null) {
            const { ticks, icon } = actions[action];

            // Show action icon for duration
            const [bundleName, alias] = icon.path.split("/").slice(-2);
            const bundle = await Assets.loadBundle(bundleName);
            const texture: Texture = bundle[alias].textures[icon.icon];
            const actionIcon = sourceEntity.actionIcon;
            if (actionIcon != null) {
                actionIcon.texture = texture;
                actionIcon.visible = true;
                actionIcon.alpha = 1;
                actionIcon.width = texture.width;
                actionIcon.height = texture.height;
                actionIcon.scale.x = HALF_ISO_CELL_WIDTH / actionIcon.width;
                actionIcon.scale.y = HALF_ISO_CELL_WIDTH / actionIcon.height;

                const duration = Math.max((ticks * MS_PER_TICK) / 1000, 1) * 2;

                // Tween alpha
                gsap.to(actionIcon, {
                    duration,
                    alpha: 0,
                    ease: "power2.in",
                    overwrite: true,
                    onComplete: () => {
                        if (actionIcon != null) {
                            actionIcon.visible = false;
                        }
                    },
                });

                // Tween scale
                gsap.to(actionIcon.scale, {
                    duration,
                    x: actionIcon.scale.x * 1.2,
                    y: actionIcon.scale.y * 1.2,
                    overwrite: true,
                    ease: "power2.out",
                });
            }
            console.log(source, `performing ${action} on`, target);
        } else if (ability != null) {
            await animateAbility(worldStage, {
                source: sourceEntity,
                target: targetEntity ?? undefined,
                ability,
            });

            console.log(source, `performing ${ability} on`, target);
        } else if (
            utility != null &&
            prop != null &&
            compendium[prop]?.utilities[utility] != null
        ) {
            const utilityRecord = compendium[prop]?.utilities[utility];
            console.log(source, `performing ${utility} on`, target);
        }
    }

    async function handlePlayerPosition(playerPosition: Position | null) {
        if (
            !isInitialized ||
            playerPosition == null ||
            worldStage == null ||
            $player == null
        ) {
            return;
        }

        // Update biomes
        drawBiomeShaders(playerPosition, worldStage);

        // Cull entity meshes outside view
        cullEntityMeshes(playerPosition, worldStage);

        // Cull world meshes outside town
        cullWorlds(playerPosition, worldStage);

        // Player
        const playerMesh = entityMeshes[$player.player];
        if (playerMesh != null && playerMesh.mesh != null) {
            // Update

            const instancePositions =
                playerMesh.shaderGeometry.geometry.getBuffer(
                    "aInstancePosition",
                );
            instancePositions.data.set([
                playerPosition.isoX,
                playerPosition.isoY,
                playerPosition.elevation,
            ]);
            instancePositions.update();
            playerMesh.position = playerPosition;

            // Tween position
            gsap.to(playerMesh.hitbox, {
                x: playerPosition.isoX,
                y: playerPosition.isoY - playerPosition.elevation,
                duration: (actions.move.ticks * MS_PER_TICK) / 1000,
            });

            // Set render order
            updateEntityMeshRenderOrder(playerMesh);
        }

        // Move camera to player
        updateCamera($player);
    }

    function onMouseMove(x: number, y: number) {
        if (playerPosition == null) {
            return;
        }

        if (isMouseDown) {
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
        if (playerPosition == null || worldStage == null) {
            return;
        }
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

    /*
     * Initialization
     */

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

        // GSAP
        gsap.registerPlugin(PixiPlugin);

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
        app.stage.hitArea = app.screen; // ensure whole canvas area is interactive

        function getMousePosition(e: FederatedMouseEvent) {
            return snapToGrid(
                e.global.x + worldStage!.pivot.x,
                e.global.y + worldStage!.pivot.y + playerPosition!.elevation, // select on the same plane as player
                HALF_ISO_CELL_WIDTH,
                HALF_ISO_CELL_HEIGHT,
            );
        }
        app.stage.onmouseup = (e) => {
            if (playerPosition != null && e.global != null) {
                const [snapX, snapY] = getMousePosition(e);
                onMouseUp(snapX, snapY);
                lastCursorX = snapX;
                lastCursorY = snapY;
                isMouseDown = false;
            }
        };
        app.stage.onmousedown = (e) => {
            if (playerPosition != null && e.global != null) {
                const [snapX, snapY] = getMousePosition(e);
                onMouseDown(snapX, snapY);
                lastCursorX = snapX;
                lastCursorY = snapY;
                isMouseDown = true;
            }
        };
        app.stage.onmousemove = (e) => {
            if (playerPosition != null && e.global != null) {
                const [snapX, snapY] = getMousePosition(e);
                if (lastCursorX !== snapX || lastCursorY !== snapY) {
                    onMouseMove(snapX, snapY);
                    lastCursorX = snapX;
                    lastCursorY = snapY;
                }
            }
        };

        // Create player mesh
        if ($player != null && playerPosition !== null) {
            await upsertEntityMesh($player, playerPosition, worldStage);
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
            await handlePlayerPosition(playerPosition);
            await updateEntities(
                $monsterRecord,
                playerPosition,
                "monster",
                worldStage,
            );
            await updateEntities(
                $playerRecord,
                playerPosition,
                "player",
                worldStage,
            );
            await updateEntities(
                $itemRecord,
                playerPosition,
                "item",
                worldStage,
            );
            await drawWorlds($worldRecord, playerPosition, worldStage);
            updateCamera($player, false);
        }
    }

    onMount(() => {
        app = new Application();
        worldStage = new Container();
        worldStage.sortableChildren = true;
        init();

        // Store subscriptions
        const subscriptions = [
            monsterRecord.subscribe((mr) => {
                if (playerPosition == null || worldStage == null) {
                    return;
                }
                updateEntities(mr, playerPosition, "monster", worldStage);
            }),
            playerRecord.subscribe((pr) => {
                if (playerPosition == null || worldStage == null) {
                    return;
                }
                updateEntities(pr, playerPosition, "player", worldStage);
            }),
            itemRecord.subscribe((ir) => {
                if (playerPosition == null || worldStage == null) {
                    return;
                }
                updateEntities(ir, playerPosition, "item", worldStage);

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
                if (playerPosition == null || worldStage == null) {
                    return;
                }
                drawWorlds(wr, playerPosition, worldStage);
            }),
            player.subscribe((p) => {
                updatePlayerPosition(p);
            }),
            target.subscribe((t) => {
                if ($player == null || worldStage == null) {
                    return;
                }
                drawTargetUI({
                    target: t,
                    entityMeshes,
                    highlight: 2,
                    source: $player,
                    stage: worldStage!,
                });
            }),
        ];

        return () => {
            for (const s of subscriptions) {
                s();
            }
        };
    });

    onDestroy(() => {
        if (app && worldStage) {
            app.stage.removeAllListeners();
            isInitialized = false; // set this so ticker stops before removing other things
            destroyShaders();
            clearInstancedShaderMeshes();
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

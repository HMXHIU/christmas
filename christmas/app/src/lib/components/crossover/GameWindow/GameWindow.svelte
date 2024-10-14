<script lang="ts">
    import {
        searchPossibleCommands,
        type GameCommand,
    } from "$lib/crossover/ir";
    import type { EntityType } from "$lib/crossover/types";
    import { playerActions } from "$lib/crossover/world/settings/actions";
    import { SkillLinesEnum } from "$lib/crossover/world/skills";
    import { cn } from "$lib/shadcn";
    import { substituteVariables } from "$lib/utils";
    import { gsap } from "gsap";
    import { onDestroy, onMount } from "svelte";
    import { addMessageFeed, clearStaleMessageFeed } from ".";
    import {
        ctaEvent,
        feedEvent,
        inGame,
        itemRecord,
        monsterRecord,
        player,
        playerAbilities,
        playerEquippedItems,
        playerRecord,
    } from "../../../../store";
    import AutocompleteGC from "../AutocompleteGC.svelte";
    import ChatInput from "../ChatInput.svelte";
    import ChatWindow from "../ChatWindow.svelte";
    import EntityDialog from "../EntityDialog.svelte";
    import Game, { tryExecuteGameCommand } from "../Game";
    import { initAssetManager } from "../Game/utils";
    import Map from "../Map/Map.svelte";
    import MudDescriptor from "../MudDescriptor.svelte";
    import Tool from "../Tool.svelte";
    import type { EntityLink } from "../types";

    const LARGE_SCREEN = 1000;
    const MEDIUM_SCREEN = 800;
    const MAP_SIZE = 150;

    let innerWidth: number; // bound to window.innerWidth
    let innerHeight: number; // bound to window.innerHeight
    let gameTop = 0;
    let gameBottom = 0;
    let mapSizeExpanded = 0;
    let commands: GameCommand[] = [];
    let command: GameCommand | null = null;
    let gameContainer: HTMLDivElement;
    let isMapExpanded = false;

    let entityId: string;
    let entityType: EntityType;
    let openDialog: boolean = false;

    function onClickEntityLink(event: CustomEvent) {
        ({ entityId, entityType } = event.detail as EntityLink);
        openDialog = true;
    }

    function toggleMapSize(event: MouseEvent) {
        const mapElement = event.currentTarget as HTMLElement;

        if (isMapExpanded) {
            gsap.to(mapElement, {
                duration: 0.5,
                width: MAP_SIZE,
                height: MAP_SIZE,
                right: 0,
                top: gameTop,
                ease: "power2.out",
            });
        } else {
            gsap.to(mapElement, {
                duration: 0.5,
                width: mapSizeExpanded,
                height: mapSizeExpanded,
                right: Math.round((innerWidth - mapSizeExpanded) / 2),
                top: Math.round((innerHeight - mapSizeExpanded) / 3),
                ease: "power2.out",
            });
        }

        isMapExpanded = !isMapExpanded;
    }

    async function onEnterKeyPress(message: string) {
        // Clear game commands
        commands = [];

        // Submit game command on enter
        if (command) {
            await onGameCommand(command);
        }
    }

    async function onPartial(message: string) {
        if (message.length > 2) {
            // Autocomplete game commands
            commands = searchPossibleCommands({
                query: message,
                playerAbilities: $playerAbilities,
                playerItems: $playerEquippedItems, // Only search on equiped items
                actions: playerActions,
                monsters: Object.values($monsterRecord),
                players: Object.values($playerRecord),
                items: Object.values($itemRecord),
                skills: [...SkillLinesEnum],
                player: $player!,
            }).commands;
        } else {
            commands = [];
        }
    }

    async function onGameCommand(command: GameCommand) {
        await tryExecuteGameCommand(command);
    }

    onMount(() => {
        // Go into game mode
        inGame.set(true);

        initAssetManager();

        // Compute game container top/bottom
        const rect = gameContainer.getBoundingClientRect();
        gameTop = rect.top;
        gameBottom = window.innerHeight - rect.bottom;

        // Computer map size expanded
        mapSizeExpanded = Math.round(
            Math.min(window.innerWidth, window.innerHeight) * 0.9,
        );

        // Store subscriptions
        const subscriptions = [
            feedEvent.subscribe(async (e) => {
                if (!e) return;
                const { type, message, variables } = e;
                // Error events
                if (type === "error") {
                    addMessageFeed({
                        message,
                        name: "Error",
                        messageFeedType: type,
                    });
                }

                // System feed
                else if (type === "system") {
                    addMessageFeed({
                        message,
                        name: "System",
                        messageFeedType: type,
                    });
                }

                // Message feed
                else if (type === "message") {
                    addMessageFeed({
                        message: variables
                            ? (substituteVariables(
                                  message,
                                  variables,
                              ) as string)
                            : message,
                        name: "",
                        messageFeedType: type,
                    });
                }
            }),
            ctaEvent.subscribe(async (e) => {
                if (!e) return;
                addMessageFeed({
                    message: e.cta.message,
                    name: "",
                    messageFeedType: "message",
                });
            }),
        ];

        // Set interval to clear stale messages
        const clearStaleMessageFeedInterval = setInterval(
            clearStaleMessageFeed,
            1000,
        );

        return () => {
            for (const unsubscribe of subscriptions) {
                unsubscribe();
            }
            clearInterval(clearStaleMessageFeedInterval);
        };
    });

    onDestroy(() => {
        // Exit game mode
        inGame.set(false);
    });
</script>

<svelte:window bind:innerWidth bind:innerHeight />

<div
    class={cn(
        "h-[calc(100dvh)] w-full flex flex-col justify-between",
        $$restProps.class,
    )}
>
    <!-- Top panel -->
    <div class="flex h-[calc(80%)]">
        <!-- Game Window -->
        <div class="flex-grow overflow-hidden" bind:this={gameContainer}>
            <Game previewCommand={command}></Game>
        </div>
        <!-- Right panel -->
        <div class="flex flex-col w-60 shrink-0 p-2 space-y-2">
            <!-- Player List -->
            <div class="h-60 bg-orange-400 shrink-0"></div>
            <!-- Quest Log -->
            <Tool tool="quests"></Tool>
            <!-- Inventory -->
            <Tool tool="inventory"></Tool>
            <!-- Abilities -->
            <Tool tool="abilities"></Tool>
        </div>
    </div>

    <!-- Autocomplete Game Commands -->
    <div class="relative">
        <AutocompleteGC
            class="pb-2 px-2 bottom-0 absolute"
            {commands}
            {onGameCommand}
            bind:command
        ></AutocompleteGC>
    </div>

    <!-- Bottom Panel -->
    <div class="h-60 flex flex-row grow">
        <div class="flex flex-col w-full min-w-60">
            <!-- Chat Input -->
            <ChatInput class="mb-1 mt-0 py-0" {onEnterKeyPress} {onPartial}
            ></ChatInput>
            <!-- Chat Window -->
            <ChatWindow class="overflow-auto" on:entityLink={onClickEntityLink}
            ></ChatWindow>
        </div>
        <!-- Environment  -->
        <div class="p-2 overflow-auto">
            <MudDescriptor on:entityLink={onClickEntityLink}></MudDescriptor>
        </div>
        <!-- Map/Look -->
        <div class="w-60 aspect-square shrink-0">
            <Map></Map>
        </div>
    </div>
</div>

<!-- Entity Dialog -->
<EntityDialog bind:open={openDialog} {entityId} {entityType}></EntityDialog>

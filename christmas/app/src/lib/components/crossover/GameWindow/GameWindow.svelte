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
        target,
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

    let commands: GameCommand[] = [];
    let command: GameCommand | null = null;

    let entityId: string;
    let entityType: EntityType;
    let openDialog: boolean = false;

    function onClickEntityLink(event: CustomEvent) {
        ({ entityId, entityType } = event.detail as EntityLink);
        openDialog = true;
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
                playerItems: $playerEquippedItems, // Only search on equiped items (what about inventory items like potion?)
                actions: playerActions,
                monsters: Object.values($monsterRecord),
                players: Object.values($playerRecord),
                items: Object.values($itemRecord),
                skills: [...SkillLinesEnum],
                player: $player!,
                target: $target ?? undefined,
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

        // Initialize assets
        initAssetManager();

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

<div
    class={cn(
        "h-[calc(100dvh)] w-full flex flex-col justify-between",
        $$restProps.class,
    )}
>
    <div class="flex flex-row h-full w-full">
        <!-- Left Panel -->
        <div class="flex flex-col flex-grow">
            <!-- Game Window -->
            <Game class="flex-grow" previewCommand={command}></Game>

            <!-- Autocomplete Game Commands -->
            <div class="relative">
                <AutocompleteGC
                    class="pb-2 px-2 bottom-0 absolute"
                    {commands}
                    {onGameCommand}
                    bind:command
                ></AutocompleteGC>
            </div>

            <!-- Chat Input -->
            <ChatInput class="mb-1 mt-0 py-0" {onEnterKeyPress} {onPartial}
            ></ChatInput>

            <!-- Bottom Panel -->
            <div class="h-80 flex flex-col overflow-auto">
                <!-- Combat Messages -->
                <ChatWindow
                    class="h-16"
                    messageFilter={["combat"]}
                    on:entityLink={onClickEntityLink}
                ></ChatWindow>
                <div class="flex flex-row">
                    <!-- NPC Dialogues/Player/System Messages -->
                    <ChatWindow
                        class="w-full min-w-60"
                        messageFilter={["system", "error", "message"]}
                        on:entityLink={onClickEntityLink}
                    ></ChatWindow>
                    <!-- Environment  -->
                    <MudDescriptor class="p-2" on:entityLink={onClickEntityLink}
                    ></MudDescriptor>
                </div>
            </div>
        </div>

        <!-- Right panel -->
        <div
            class="flex flex-col min-w-60 p-2 space-y-2 overflow-y-auto justify-between"
        >
            <!-- Inventory -->
            <Tool tool="inventory"></Tool>
            <!-- Abilities -->
            <Tool tool="abilities"></Tool>
            <!-- Quest Log -->
            <Tool tool="quests"></Tool>
            <!-- Map/Look -->
            <Map></Map>
        </div>
    </div>
</div>

<!-- Entity Dialog -->
<EntityDialog bind:open={openDialog} {entityId} {entityType}></EntityDialog>

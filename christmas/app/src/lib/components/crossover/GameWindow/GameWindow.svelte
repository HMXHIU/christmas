<script lang="ts">
    import ScrollArea from "$lib/components/ui/scroll-area/scroll-area.svelte";
    import {
        searchPossibleCommands,
        type GameCommand,
    } from "$lib/crossover/ir";
    import { generateAttackMessage } from "$lib/crossover/mud/combat";
    import type { Actor, EntityType } from "$lib/crossover/types";
    import { MS_PER_TICK } from "$lib/crossover/world/settings";
    import {
        actions,
        playerActions,
    } from "$lib/crossover/world/settings/actions";
    import { skillLines } from "$lib/crossover/world/settings/skills";
    import {
        learningDialoguesForSkill,
        SkillLinesEnum,
    } from "$lib/crossover/world/skills";
    import { cn } from "$lib/shadcn";
    import { sleep, substituteVariables } from "$lib/utils";
    import { onDestroy, onMount } from "svelte";
    import { get } from "svelte/store";
    import { addMessageFeed } from ".";
    import {
        actionEvent,
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

    const LARGE_SCREEN = 1000;

    let innerWidth: number; // bound to window.innerWidth
    let innerHeight: number; // bound to window.innerHeight

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

        // Generate messages from events
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
            actionEvent.subscribe(async (e) => {
                if (!e) return;

                const {
                    source,
                    target,
                    ability,
                    action,
                    weapon,
                    damage,
                    damageType,
                    bodyPart,
                    skill,
                } = e;

                // Attack
                if (action === "attack" || ability) {
                    if (!target) return;
                    const sourceActor: Actor =
                        get(playerRecord)[source] ||
                        get(monsterRecord)[source] ||
                        get(itemRecord)[source];
                    const targetActor: Actor =
                        get(playerRecord)[target] ||
                        get(monsterRecord)[target] ||
                        get(itemRecord)[target];
                    const weaponItem = weapon
                        ? get(itemRecord)[weapon]
                        : undefined;

                    if (!sourceActor || !targetActor) return;

                    const attackMessage = generateAttackMessage({
                        source: sourceActor,
                        target: targetActor,
                        ability,
                        weapon: weaponItem,
                        bodyPart,
                        damage,
                        damageType,
                        selfId: get(player)?.player,
                    });

                    addMessageFeed({
                        message: attackMessage,
                        name: "",
                        messageFeedType: "combat",
                    });
                }
                // Learn
                else if (action === "learn" && skill && source && target) {
                    const student = get(player);
                    const teacher = get(playerRecord)[source];
                    if (student && student.player === target) {
                        // Get skill learning dialogues
                        const learningDialogues = learningDialoguesForSkill(
                            skill,
                            student.skills[skill] ?? 1,
                        );
                        // Start lesson dialogues
                        for (const msg of learningDialogues) {
                            const message = substituteVariables(msg, {
                                player: student,
                                teacher,
                                skill: skillLines[skill],
                            });

                            addMessageFeed({
                                message,
                                name: "",
                                messageFeedType: "message",
                            });

                            await sleep(
                                (actions.learn.ticks * MS_PER_TICK) /
                                    learningDialogues.length,
                            );
                        }
                    }
                }
            }),
        ];
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
    <!-- Top Panel -->
    <div class="flex flex-row h-full w-full overflow-y-auto">
        <!-- Game Window (need fixed width to resize properly 16rem = w-64) -->
        <Game class="w-[calc(100%-16rem)]" previewCommand={command}></Game>

        <!-- Tools panel -->
        <ScrollArea class="flex flex-col w-64 p-2 space-y-2 justify-between">
            <!-- Inventory -->
            <Tool tool="inventory"></Tool>
            <!-- Abilities -->
            <Tool tool="abilities"></Tool>
            <!-- Quest Log -->
            <Tool tool="quests"></Tool>
        </ScrollArea>
    </div>

    <!-- Autocomplete Game Commands -->
    <div class="w-[calc(100%-16rem)] relative">
        <div class="w-96 bottom-2 m-auto left-0 right-0 absolute">
            <AutocompleteGC
                class="pb-2 px-2"
                {commands}
                {onGameCommand}
                bind:command
            ></AutocompleteGC>
            <!-- Chat Input -->
            <ChatInput
                class="m-0 p-0  bg-background"
                {onEnterKeyPress}
                {onPartial}
            ></ChatInput>
        </div>
    </div>

    <!-- Chat Windows -->
    <div class="h-64 p-0 m-0 grid grid-cols-11 gap-1">
        {#if innerWidth < LARGE_SCREEN}
            <!-- Combat Messages + NPC Dialogues/Player/System Messages -->
            <ChatWindow
                class="col-span-6 p-2 pr-0 h-64"
                messageFilter={["system", "error", "message", "combat"]}
                on:entityLink={onClickEntityLink}
            ></ChatWindow>
            <!-- Environment/Map/Look  -->
            <div class="flex flex-col col-span-5 h-64">
                <ScrollArea>
                    <MudDescriptor class="p-2" on:entityLink={onClickEntityLink}
                    ></MudDescriptor>
                    <Map class="p-2 w-80 min-w-64 mx-auto"></Map>
                </ScrollArea>
            </div>
        {:else}
            <!-- NPC Dialogues/Player/System Messages -->
            <ChatWindow
                class="col-span-3 p-2 pr-0 h-64"
                messageFilter={["system", "error", "message"]}
                on:entityLink={onClickEntityLink}
            ></ChatWindow>
            <!-- Combat Messages -->
            <ChatWindow
                class="col-span-3 p-2 pr-2 h-64"
                messageFilter={["combat"]}
                on:entityLink={onClickEntityLink}
            ></ChatWindow>
            <!-- Environment/Map/Look  -->
            <div class="flex flex-row col-span-5 h-64">
                <MudDescriptor class="p-2" on:entityLink={onClickEntityLink}
                ></MudDescriptor>
                <Map class="w-64 min-w-64"></Map>
            </div>
        {/if}
    </div>
</div>

<!-- Entity Dialog -->
<EntityDialog bind:open={openDialog} {entityId} {entityType}></EntityDialog>

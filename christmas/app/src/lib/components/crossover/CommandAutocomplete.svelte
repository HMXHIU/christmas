<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Command from "$lib/components/ui/command/index.js";
    import type { GameCommand, TokenPositions } from "$lib/crossover/ir";
    import { entityId, gameActionId } from "$lib/crossover/utils";
    import type { AbilityType } from "$lib/crossover/world/abilities";
    import { abilities } from "$lib/crossover/world/settings";
    import { cn } from "$lib/shadcn";
    import { groupBy } from "lodash";
    import {
        ChevronRight,
        CornerDownLeft,
        Cross,
        Shield,
        Sword,
        Wrench,
    } from "lucide-svelte";

    export let commands: GameCommand[] = [];
    export let queryTokens: string[];
    export let tokenPositions: TokenPositions;
    export let command: GameCommand | null = null;
    export let onGameCommand: (
        command: GameCommand,
        queryTokens: string[],
        tokenPositions: TokenPositions,
    ) => void;

    let value: string = "0-0";

    $: groupedCommands = groupBy(commands, (gc: GameCommand) => {
        if ("utility" in gc[0]) {
            return "Items";
        } else if ("ability" in gc[0]) {
            return "Abilities";
        } else if ("action" in gc[0]) {
            return "Actions";
        } else {
            return "Other";
        }
    });
    // Default to first command
    $: command = commands[0] || null;
    $: value = commands.length > 0 ? "0-0" : "0-0";

    function targetName(command: GameCommand): string {
        const [action, { target }] = command;
        if (target) {
            return `${target.name} (${entityId(target).slice(0, 8)}...)`;
        }
        return "";
    }

    function abilityType(command: GameCommand): AbilityType {
        const [action, entities] = command;
        return "ability" in action
            ? abilities[action.ability!].type
            : "neutral";
    }

    function commandName(command: GameCommand): string {
        const [action, entities] = command;
        return gameActionId(action);
    }

    function onSubmit() {
        if (command) {
            onGameCommand(command, queryTokens, tokenPositions);
        }
    }
</script>

{#if Object.keys(groupedCommands).length > 0}
    <div class={cn($$restProps.class)}>
        <Command.Root class="rounded-lg border shadow-md" {value}>
            <Command.List>
                {#each Object.entries(groupedCommands) as [group, _commands], groupIdx (group)}
                    <Command.Group heading={group}>
                        {#each _commands as _command, commandIdx}
                            <Command.Item
                                class="justify-between"
                                value={`${groupIdx}-${commandIdx}`}
                                onSelect={() => {
                                    command = _command;
                                    value = `${groupIdx}-${commandIdx}`;
                                }}
                            >
                                <div class="flex flex-row items-center">
                                    <!-- Command Icon -->
                                    {#if abilityType(_command) === "offensive"}
                                        <Sword class="mr-2 h-4 w-4" />
                                    {:else if abilityType(_command) === "defensive"}
                                        <Shield class="mr-2 h-4 w-4" />
                                    {:else if abilityType(_command) === "healing"}
                                        <Cross class="mr-2 h-4 w-4" />
                                    {:else if abilityType(_command) === "neutral"}
                                        <Wrench class="mr-2 h-4 w-4" />
                                    {/if}
                                    <!-- Ability -->
                                    <span>{commandName(_command)}</span>
                                    <!-- Target -->
                                    <ChevronRight class="w-4 h-4"
                                    ></ChevronRight>
                                    <span>{targetName(_command)}</span>
                                </div>
                                <!-- Default [Enter] -->
                                {#if `${groupIdx}-${commandIdx}` === value}
                                    <Button
                                        variant="secondary"
                                        class="h-5 px-2"
                                        on:click={onSubmit}
                                    >
                                        <CornerDownLeft class="w-3 h-3 mr-2"
                                        ></CornerDownLeft>
                                        <span class="text-xs">Enter</span>
                                    </Button>
                                {/if}
                            </Command.Item>
                        {/each}
                    </Command.Group>
                {/each}
            </Command.List>
        </Command.Root>
    </div>
{/if}

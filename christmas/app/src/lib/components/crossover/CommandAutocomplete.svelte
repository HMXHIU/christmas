<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Command from "$lib/components/ui/command/index.js";
    import type { GameCommand } from "$lib/crossover/ir";
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

    export let gameCommands: GameCommand[] = [];
    export let selected: GameCommand | null = null;
    export let onGameCommand: (gameCommand: GameCommand) => void;

    let value: string = "0-0";

    $: groupedCommands = groupBy(gameCommands, (gc: GameCommand) => {
        if ("action" in gc[0]) {
            return "Item Actions";
        } else if ("ability" in gc[0]) {
            return "Abilities";
        } else {
            return "Other";
        }
    });
    // Default to first command
    $: selected = gameCommands[0] || null;
    $: value = gameCommands.length > 0 ? "0-0" : "0-0";

    function targetName(command: GameCommand): string {
        if ("player" in command[1].target) {
            return `${command[1].target.name} (${command[1].target.player.slice(0, 7)}...)`;
        } else if ("item" in command[1].target) {
            return `${command[1].target.name} (${command[1].target.item})`;
        } else if ("monster" in command[1].target) {
            return `${command[1].target.name} (${command[1].target.monster})`;
        }
        return "unknown target";
    }

    function abilityType(command: GameCommand): AbilityType {
        return command[0].ability
            ? abilities[command[0].ability].type
            : "neutral";
    }

    function commandName(command: GameCommand): string {
        return "action" in command[0] ? command[0].action : command[0].ability;
    }

    function onSubmit() {
        if (selected) {
            onGameCommand(selected);
        }
    }
</script>

<div class={cn($$restProps.class)}>
    <Command.Root class="rounded-lg border shadow-md" {value}>
        <Command.List>
            {#each Object.entries(groupedCommands) as [group, commands], groupIdx (group)}
                <Command.Group heading={group}>
                    {#each commands as command, commandIdx}
                        <Command.Item
                            class="justify-between"
                            value={`${groupIdx}-${commandIdx}`}
                            onSelect={() => {
                                selected = command;
                                value = `${groupIdx}-${commandIdx}`;
                            }}
                        >
                            <div class="flex flex-row items-center">
                                <!-- Command Icon -->
                                {#if abilityType(command) === "offensive"}
                                    <Sword class="mr-2 h-4 w-4" />
                                {:else if abilityType(command) === "defensive"}
                                    <Shield class="mr-2 h-4 w-4" />
                                {:else if abilityType(command) === "healing"}
                                    <Cross class="mr-2 h-4 w-4" />
                                {:else if abilityType(command) === "neutral"}
                                    <Wrench class="mr-2 h-4 w-4" />
                                {/if}
                                <!-- Ability -->
                                <span>{commandName(command)}</span>
                                <!-- Target -->
                                <ChevronRight class="w-4 h-4"></ChevronRight>
                                <span>{targetName(command)}</span>
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

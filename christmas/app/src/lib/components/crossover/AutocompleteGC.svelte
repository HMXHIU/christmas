<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Command from "$lib/components/ui/command/index.js";
    import type { GameCommand } from "$lib/crossover/ir";
    import {
        REGEX_STRIP_ENTITY_TYPE,
        gameActionId,
        getEntityId,
    } from "$lib/crossover/utils";
    import {
        abilities,
        type AbilityType,
    } from "$lib/crossover/world/abilities";
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
    export let command: GameCommand | null = null;
    export let onGameCommand: (command: GameCommand) => Promise<void>;

    let value: string = "0-0";

    $: groupedCommandsEntries = Object.entries(
        groupBy(commands, (gc: GameCommand) => {
            if ("utility" in gc[0]) {
                return "Items";
            } else if ("ability" in gc[0]) {
                return "Abilities";
            } else if ("action" in gc[0]) {
                return "Actions";
            } else {
                return "Other";
            }
        }),
    );

    // Default to first command
    $: command = commands[0] || null;
    $: value = commands.length > 0 ? "0-0" : "0-0";

    function targetName(gc: GameCommand): string {
        const [action, { target }] = gc;

        if (target) {
            let id = getEntityId(target)[0].replace(
                REGEX_STRIP_ENTITY_TYPE,
                "",
            );
            id = id.length > 13 ? id.slice(0, 13) + "..." : id;
            return `${target.name} (${id})`;
        }
        return "";
    }

    function itemName(gc: GameCommand): string {
        const [action, { item }] = gc;

        if (item) {
            let id = getEntityId(item)[0].replace(REGEX_STRIP_ENTITY_TYPE, "");
            id = id.length > 13 ? id.slice(0, 13) + "..." : id;
            return `${item.name} (${id})`;
        }

        return "";
    }

    function abilityType(gc: GameCommand): AbilityType {
        const [action, entities] = gc;
        return "ability" in action
            ? abilities[action.ability!].type
            : "neutral";
    }

    function commandName(gc: GameCommand): string {
        const [action, entities] = gc;
        return gameActionId(action);
    }

    function commandInfo(gc: GameCommand): string {
        const [action, entities, variables] = gc;
        if ("utility" in action) {
            return `dur: ${action.cost.durability} cha: ${action.cost.charges}`;
        } else if ("ability" in action) {
            return `ap: ${action.ap} st: ${action.st} mp: ${action.mp} hp: ${action.hp}`;
        } else if ("action" in action) {
            if (action.action === "say") {
                return `${variables?.queryIrrelevant}`;
            }
        }
        return "";
    }

    async function onSubmit() {
        if (command) {
            await onGameCommand(command);
        }
    }
</script>

{#key groupedCommandsEntries}
    {#if groupedCommandsEntries.length > 0}
        <div class={cn($$restProps.class)}>
            <Command.Root class="rounded-lg border shadow-md" {value}>
                <Command.List>
                    {#each groupedCommandsEntries as [group, gcs], groupIdx}
                        <Command.Group heading={group}>
                            {#each gcs as gc, commandIdx}
                                <Command.Item
                                    class="justify-between"
                                    value={`${groupIdx}-${commandIdx}`}
                                    onSelect={() => {
                                        command = gc;
                                        value = `${groupIdx}-${commandIdx}`;
                                    }}
                                >
                                    <div class="flex flex-row items-center">
                                        <!-- Command Icon -->
                                        {#if abilityType(gc) === "offensive"}
                                            <Sword class="mr-3 h-4 w-4" />
                                        {:else if abilityType(gc) === "defensive"}
                                            <Shield class="mr-3 h-4 w-4" />
                                        {:else if abilityType(gc) === "healing"}
                                            <Cross class="mr-3 h-4 w-4" />
                                        {:else if abilityType(gc) === "neutral"}
                                            <Wrench class="mr-3 h-4 w-4" />
                                        {/if}
                                        <span>{commandName(gc)}</span>
                                        {#each [itemName(gc), targetName(gc), commandInfo(gc)] as s}
                                            {#if s}
                                                <ChevronRight class="w-4 h-4"
                                                ></ChevronRight>
                                                <span>{s}</span>
                                            {/if}
                                        {/each}
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
{/key}

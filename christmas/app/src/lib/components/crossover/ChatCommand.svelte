<script lang="ts">
    // Components
    import { tick } from "svelte";
    import {
        MessageSquare,
        Grab,
        FlameKindling,
        ArrowLeft,
    } from "lucide-svelte";
    import * as Command from "$lib/components/ui/command";
    import * as Popover from "$lib/components/ui/popover";
    import { Button } from "$lib/components/ui/button";
    import { cn } from "$lib/shadcn";

    export let value = "";
    let open = false;

    const commandsGroups: [
        [string, string],
        [string, string, any | null, string | null][],
    ][] = [
        // Speech
        [
            ["speech", "Speech"],
            [
                ["say", "Say", MessageSquare, "⌘S"],
                ["shout", "Shout", MessageSquare, null],
                ["fusrodah", "FusRoDah!!", MessageSquare, null],
            ],
        ],
        // Combat
        [
            ["combat", "Combat"],
            [
                ["punch", "Punch", Grab, "⌘P"],
                ["flee", "Flee", ArrowLeft, "⌘F"],
            ],
        ],
        // Out of Combat (OOC)
        [
            ["ooc", "Out of Combat (OOC)"],
            [["rest", "Rest", FlameKindling, "⌘R"]],
        ],
    ];

    $: selectedCommand = findCommand(value) || findCommand("say");

    function findCommand(value: string) {
        for (const [[groupKey, groupLabel], commands] of commandsGroups) {
            for (const [commandKey, commandLabel, icon, shortcut] of commands) {
                if (commandKey === value) {
                    return {
                        groupKey,
                        groupLabel,
                        commandKey,
                        commandLabel,
                        icon,
                        shortcut,
                    };
                }
            }
        }
        return null;
    }

    function closeAndFocusTrigger(triggerId: string) {
        open = false;
        tick().then(() => {
            document.getElementById(triggerId)?.focus();
        });
    }
</script>

<Popover.Root bind:open let:ids>
    <Popover.Trigger asChild let:builder>
        <Button
            builders={[builder]}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            class={cn("flex flex-row gap-2", $$restProps.class)}
        >
            {#if selectedCommand?.icon}
                <svelte:component
                    this={selectedCommand.icon}
                    class="p-0 m-0 h-4 w-4 opacity-50"
                />
            {/if}
            <span>{selectedCommand?.commandLabel || ""}</span>
        </Button>
    </Popover.Trigger>
    <Popover.Content class="w-[200px] p-0">
        <Command.Root class="max-w-[450px] rounded-lg border shadow-md">
            <Command.Input placeholder="Search Command..." />
            <Command.List>
                <Command.Empty>No such command.</Command.Empty>
                {#each commandsGroups as [[groupKey, groupLabel], commands] (groupKey)}
                    <Command.Group heading={groupLabel}>
                        {#each commands as [commandKey, commandLabel, icon, shortcut] (commandKey)}
                            <Command.Item
                                value={commandKey}
                                onSelect={(currentValue) => {
                                    value = currentValue;
                                    closeAndFocusTrigger(ids.trigger);
                                }}
                            >
                                {#if icon}
                                    <svelte:component
                                        this={icon}
                                        class="mr-2 h-4 w-4"
                                    />
                                {/if}
                                <span>{commandLabel}</span>
                                {#if shortcut}
                                    <Command.Shortcut
                                        >{shortcut}</Command.Shortcut
                                    >
                                {/if}
                            </Command.Item>
                        {/each}
                    </Command.Group>
                {/each}
            </Command.List>
        </Command.Root>
    </Popover.Content>
</Popover.Root>

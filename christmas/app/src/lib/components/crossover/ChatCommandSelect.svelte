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
    import type { ChatCommand, ChatCommandGroup } from "$lib/crossover/types";

    export let value: ChatCommand | null | undefined = findCommand("say");

    let open = false;

    const commandsGroups: [ChatCommandGroup, ChatCommand[]][] = [
        // Speech
        [
            { key: "speech", label: "Speech" },
            [
                {
                    key: "say",
                    label: "Say",
                    icon: MessageSquare,
                    shortcut: "⌘S",
                },
                {
                    key: "shout",
                    label: "Shout",
                    icon: MessageSquare,
                    shortcut: null,
                },
                {
                    key: "whisper",
                    label: "Whisper",
                    icon: MessageSquare,
                    shortcut: null,
                },
            ],
        ],
        // Combat
        [
            { key: "combat", label: "Combat" },
            [
                { key: "punch", label: "Punch", icon: Grab, shortcut: "⌘P" },
                { key: "flee", label: "Flee", icon: ArrowLeft, shortcut: "⌘F" },
            ],
        ],
        // Out of Combat (OOC)
        [
            { key: "ooc", label: "Out of Combat (OOC)" },
            [
                {
                    key: "rest",
                    label: "Rest",
                    icon: FlameKindling,
                    shortcut: "⌘R",
                },
            ],
        ],
    ];

    // $: selectedCommand = findCommand(value.key) || findCommand("say");

    function findCommand(key: string): ChatCommand | null {
        for (const [group, commands] of commandsGroups) {
            for (const command of commands) {
                if (command.key === key) {
                    return command;
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
            class={cn("flex flex-row gap-2 p-2", $$restProps.class)}
        >
            {#if value?.icon}
                <svelte:component
                    this={value.icon}
                    class="p-0 m-0 h-4 w-4 opacity-50"
                />
            {/if}
            <span>{value?.label || ""}</span>
        </Button>
    </Popover.Trigger>
    <Popover.Content class="w-[200px] p-0">
        <Command.Root class="max-w-[450px] rounded-lg border shadow-md">
            <Command.Input placeholder="Search Command..." />
            <Command.List>
                <Command.Empty>No such command.</Command.Empty>
                {#each commandsGroups as [group, commands] (group.key)}
                    <Command.Group heading={group.label}>
                        {#each commands as command (command.key)}
                            <Command.Item
                                value={command.key}
                                onSelect={(currentValue) => {
                                    value = command;
                                    closeAndFocusTrigger(ids.trigger);
                                }}
                            >
                                {#if command.icon}
                                    <svelte:component
                                        this={command.icon}
                                        class="mr-2 h-4 w-4"
                                    />
                                {/if}
                                <span>{command.label}</span>
                                {#if command.shortcut}
                                    <Command.Shortcut
                                        >{command.shortcut}</Command.Shortcut
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

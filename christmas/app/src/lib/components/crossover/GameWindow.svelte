<script lang="ts">
    import type { MessageFeedUI } from "$lib/components/common/types";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Collapsible from "$lib/components/ui/collapsible/index.js";
    import type { GameCommand } from "$lib/crossover/ir";
    import type { Direction } from "$lib/crossover/world";
    import { cn } from "$lib/shadcn";
    import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
    import { Assets } from "pixi.js";
    import { onMount } from "svelte";
    import { tile } from "../../../store";
    import Chat from "./Chat.svelte";
    import ContextSection from "./ContextSection.svelte";
    import Map from "./Map.svelte";

    export let messageFeed: MessageFeedUI[] = [];
    export let onMove: (direction: Direction) => void;
    export let onGameCommand: (command: GameCommand) => Promise<void>;

    // TODO: convert these to special commands
    //
    // let defaultCommand = "say";
    // let commandGroups: [ChatCommandGroupUI, ChatCommandUI[]][] = [
    //     // Speech
    //     [
    //         { key: "speech", label: "Speech" },
    //         [
    //             {
    //                 key: "say",
    //                 label: "Say",
    //                 icon: MessageSquare,
    //                 shortcut: "⌘S",
    //                 description: "Say something to everyone in the room.",
    //             },
    //             {
    //                 key: "shout",
    //                 label: "Shout",
    //                 icon: MessageSquare,
    //                 shortcut: null,
    //                 description: "Shout something to everyone in the area.",
    //             },
    //             {
    //                 key: "whisper",
    //                 label: "Whisper",
    //                 icon: MessageSquare,
    //                 shortcut: null,
    //                 description: "Whisper something to someone.",
    //             },
    //         ],
    //     ],
    //     // Combat
    //     [
    //         { key: "combat", label: "Combat" },
    //         [
    //             {
    //                 key: "punch",
    //                 label: "Punch",
    //                 icon: Grab,
    //                 shortcut: "⌘P",
    //                 description: "Punch someone.",
    //             },
    //             {
    //                 key: "flee",
    //                 label: "Flee",
    //                 icon: ArrowLeft,
    //                 shortcut: "⌘F",
    //                 description: "Flee from combat.",
    //             },
    //         ],
    //     ],
    //     // Out of Combat (OOC)
    //     [
    //         { key: "ooc", label: "Out of Combat (OOC)" },
    //         [
    //             {
    //                 key: "look",
    //                 label: "Look",
    //                 icon: Eye,
    //                 shortcut: "⌘L",
    //                 description: "Look at something.",
    //             },
    //             {
    //                 key: "rest",
    //                 label: "Rest",
    //                 icon: FlameKindling,
    //                 shortcut: "⌘R",
    //                 description: "Rest and recover.",
    //             },
    //         ],
    //     ],
    //     // Dungeon Master
    //     [
    //         { key: "dm", label: "Dungeon Master" },
    //         [
    //             {
    //                 key: "spawnItem",
    //                 label: "Spawn Item",
    //                 icon: Wand2,
    //                 shortcut: "",
    //                 description: "Spawn Item.",
    //             },
    //             {
    //                 key: "spawnMonster",
    //                 label: "Spawn Monster",
    //                 icon: Wand2,
    //                 shortcut: "",
    //                 description: "Spawn Monster.",
    //             },
    //         ],
    //     ],
    // ];

    onMount(async () => {
        // Load assets in background
        await Assets.init({ manifest: "/sprites/manifest.json" });
        Assets.backgroundLoadBundle(["player", "biomes", "bestiary", "props"]);
    });
</script>

<div class={cn("w-full flex flex-col", $$restProps.class)}>
    <!-- Chat -->
    <Chat {messageFeed} {onGameCommand} class="h-3/5"></Chat>
    <!-- Context Section -->
    <ContextSection {tile} {onMove} class="h-2/5 pt-2"></ContextSection>
    <!-- Map -->
    {#if $tile}
        <div class="fixed top-20 right-0">
            <Collapsible.Root class="w-[200px] space-y-2">
                <div
                    class="flex items-center justify-end text-right space-x-4 px-4"
                >
                    <Collapsible.Trigger asChild let:builder>
                        <Button builders={[builder]} variant="ghost" size="sm">
                            {$tile.name}
                            <ChevronsUpDown class="h-4 w-4 ml-2" />
                        </Button>
                    </Collapsible.Trigger>
                </div>
                <Collapsible.Content>
                    <Map></Map>
                </Collapsible.Content>
            </Collapsible.Root>
        </div>
    {/if}
</div>

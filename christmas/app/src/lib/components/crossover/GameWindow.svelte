<script lang="ts">
    import Chat from "$lib/components/common/Chat.svelte";
    import type {
        ChatCommandGroupUI,
        ChatCommandUI,
        MessageFeedUI,
    } from "$lib/components/common/types";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Collapsible from "$lib/components/ui/collapsible/index.js";
    import type { Direction } from "$lib/crossover/world";
    import { abyssTile } from "$lib/crossover/world/resources";
    import type { Player } from "$lib/server/crossover/redis/entities";
    import type { TileSchema } from "$lib/server/crossover/router";
    import { cn } from "$lib/shadcn";
    import {
        ArrowLeft,
        Eye,
        FlameKindling,
        Grab,
        MessageSquare,
    } from "lucide-svelte";
    import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
    import { Assets } from "pixi.js";
    import { onMount } from "svelte";
    import { z } from "zod";
    import ContextSection from "./ContextSection.svelte";
    import Map from "./Map.svelte";

    export let players: Player[] = [];
    export let tile: z.infer<typeof TileSchema> = abyssTile;
    export let onMove: (direction: Direction) => void;

    export let messageFeed: MessageFeedUI[] = [];
    export let onChatMessage: (
        command: ChatCommandUI | null,
        message: string,
    ) => void;

    let defaultCommand = "say";
    let commandGroups: [ChatCommandGroupUI, ChatCommandUI[]][] = [
        // Speech
        [
            { key: "speech", label: "Speech" },
            [
                {
                    key: "say",
                    label: "Say",
                    icon: MessageSquare,
                    shortcut: "⌘S",
                    description: "Say something to everyone in the room.",
                },
                {
                    key: "shout",
                    label: "Shout",
                    icon: MessageSquare,
                    shortcut: null,
                    description: "Shout something to everyone in the area.",
                },
                {
                    key: "whisper",
                    label: "Whisper",
                    icon: MessageSquare,
                    shortcut: null,
                    description: "Whisper something to someone.",
                },
            ],
        ],
        // Combat
        [
            { key: "combat", label: "Combat" },
            [
                {
                    key: "punch",
                    label: "Punch",
                    icon: Grab,
                    shortcut: "⌘P",
                    description: "Punch someone.",
                },
                {
                    key: "flee",
                    label: "Flee",
                    icon: ArrowLeft,
                    shortcut: "⌘F",
                    description: "Flee from combat.",
                },
            ],
        ],
        // Out of Combat (OOC)
        [
            { key: "ooc", label: "Out of Combat (OOC)" },
            [
                {
                    key: "look",
                    label: "Look",
                    icon: Eye,
                    shortcut: "⌘L",
                    description: "Look at something.",
                },
                {
                    key: "rest",
                    label: "Rest",
                    icon: FlameKindling,
                    shortcut: "⌘R",
                    description: "Rest and recover.",
                },
            ],
        ],
    ];

    onMount(async () => {
        // Load assets in background
        // Load assets
        await Assets.init({ manifest: "/sprites/manifest.json" });
        Assets.backgroundLoadBundle(["player", "biomes", "bestiary"]);
    });
</script>

<div class={cn("w-full flex flex-col", $$restProps.class)}>
    <!-- Chat -->
    <Chat
        {messageFeed}
        {onChatMessage}
        {commandGroups}
        {defaultCommand}
        class="h-3/5"
    ></Chat>
    <!-- Context Section -->
    <ContextSection {players} {tile} {onMove} class="h-2/5 pt-2"
    ></ContextSection>
    <!-- Map -->
    <div class="fixed top-20 right-0">
        <Collapsible.Root class="w-[200px] space-y-2">
            <div
                class="flex items-center justify-end text-right space-x-4 px-4"
            >
                <Collapsible.Trigger asChild let:builder>
                    <Button builders={[builder]} variant="ghost" size="sm">
                        {tile.name}
                        <ChevronsUpDown class="h-4 w-4 ml-2" />
                    </Button>
                </Collapsible.Trigger>
            </div>
            <Collapsible.Content>
                <Map {tile}></Map>
            </Collapsible.Content>
        </Collapsible.Root>
    </div>
</div>

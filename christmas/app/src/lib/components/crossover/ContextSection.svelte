<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { ScrollArea } from "$lib/components/ui/scroll-area";
    import type { z } from "zod";

    import type { Player } from "$lib/server/crossover/redis/entities";
    import type { TileSchema } from "$lib/server/crossover/router";
    import {
        ArrowDown,
        ArrowDownLeft,
        ArrowDownRight,
        ArrowDownSquare,
        ArrowLeft,
        ArrowRight,
        ArrowUp,
        ArrowUpLeft,
        ArrowUpRight,
        ArrowUpSquare,
        Box,
        Map,
    } from "lucide-svelte";

    import * as Card from "$lib/components/ui/card/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import * as Tabs from "$lib/components/ui/tabs/index.js";
    import type { Direction } from "$lib/crossover/world";
    import { abyssTile } from "$lib/crossover/world";
    import { cn } from "$lib/shadcn";

    export let tile: z.infer<typeof TileSchema> = abyssTile;
    export let players: Player[] = [];

    export let onMove: (direction: Direction) => void;
</script>

<div class={cn("w-full", $$restProps.class)}>
    <Tabs.Root value="location" class="w-full">
        <Tabs.List class="grid w-full grid-cols-2">
            <Tabs.Trigger value="location"><Map size={20} /></Tabs.Trigger>
            <Tabs.Trigger value="inventory"><Box size={20} /></Tabs.Trigger>
        </Tabs.List>
        <!-- Location -->
        <Tabs.Content value="location">
            <Card.Root>
                <Card.Content class="py-2">
                    <div class="flex justify-between">
                        <ScrollArea class="h-[250px]">
                            <!-- Tile -->
                            <p class="text-sm text-primary-background">
                                {tile.name || tile.geohash}
                            </p>
                            <p class="text-sm text-muted-foreground">
                                {tile.description}
                            </p>

                            <!-- NPCs -->
                            <!-- Items -->
                            <!-- Players -->
                            {#if players.length > 0}
                                <p class="text-sm text-primary-background">
                                    You see some people here
                                </p>
                            {/if}
                            <div
                                class="flex gap-2 text-sm text-muted-foreground"
                            >
                                {#each players as player (player.player)}
                                    <p>{player.name}</p>
                                {/each}
                            </div>
                        </ScrollArea>
                        <!-- Movement -->
                        <div class="flex-shrink-0">
                            <div></div>
                            <div class="grid grid-cols-3 gap-2">
                                <Button
                                    variant="outline"
                                    class="w-14 h-14"
                                    on:click={() => onMove("nw")}
                                    ><ArrowUpLeft size={20} /></Button
                                >
                                <Button
                                    variant="outline"
                                    class="w-14 h-14"
                                    on:click={() => onMove("n")}
                                    ><ArrowUp size={20} /></Button
                                >
                                <Button
                                    variant="outline"
                                    class="w-14 h-14"
                                    on:click={() => onMove("ne")}
                                    ><ArrowUpRight size={20} /></Button
                                >
                                <Button
                                    variant="outline"
                                    class="w-14 h-14"
                                    on:click={() => onMove("w")}
                                    ><ArrowLeft size={20} /></Button
                                >
                                <div></div>
                                <Button
                                    variant="outline"
                                    class="w-14 h-14"
                                    on:click={() => onMove("e")}
                                    ><ArrowRight size={20} /></Button
                                >
                                <Button
                                    variant="outline"
                                    class="w-14 h-14"
                                    on:click={() => onMove("sw")}
                                    ><ArrowDownLeft size={20} /></Button
                                >
                                <Button
                                    variant="outline"
                                    class="w-14 h-14"
                                    on:click={() => onMove("s")}
                                    ><ArrowDown size={20} /></Button
                                >
                                <Button
                                    variant="outline"
                                    class="w-14 h-14"
                                    on:click={() => onMove("se")}
                                    ><ArrowDownRight size={20} /></Button
                                >
                                <Button
                                    variant="outline"
                                    class="w-14 h-14"
                                    on:click={() => onMove("d")}
                                    ><ArrowDownSquare size={20} /></Button
                                >
                                <Button
                                    variant="outline"
                                    class="w-14 h-14"
                                    on:click={() => onMove("u")}
                                    ><ArrowUpSquare size={20} /></Button
                                >
                            </div>
                        </div>
                    </div>
                </Card.Content>
            </Card.Root>
        </Tabs.Content>
        <Tabs.Content value="inventory">
            <Card.Root>
                <Card.Header>
                    <Card.Title>Password</Card.Title>
                    <Card.Description>
                        Change your password here. After saving, you'll be
                        logged out.
                    </Card.Description>
                </Card.Header>
                <Card.Content class="space-y-2">
                    <div class="space-y-1">
                        <Label for="current">Current password</Label>
                        <Input id="current" type="password" />
                    </div>
                    <div class="space-y-1">
                        <Label for="new">New password</Label>
                        <Input id="new" type="password" />
                    </div>
                </Card.Content>
                <Card.Footer>
                    <Button>Save password</Button>
                </Card.Footer>
            </Card.Root>
        </Tabs.Content>
    </Tabs.Root>
</div>

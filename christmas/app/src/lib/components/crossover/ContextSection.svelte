<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Card from "$lib/components/ui/card/index.js";
    import { ScrollArea } from "$lib/components/ui/scroll-area";
    import * as Tabs from "$lib/components/ui/tabs/index.js";
    import type { Direction } from "$lib/crossover/world/types";
    import { cn } from "$lib/shadcn";
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
        BrickWall,
        Hammer,
        Landmark,
        Map,
        Trees,
    } from "lucide-svelte";
    import Inventory from "./Inventory.svelte";
    import ItemList from "./ItemList.svelte";
    import MonsterList from "./MonsterList.svelte";
    import PlayerList from "./PlayerList.svelte";
    import TileInfo from "./TileInfo.svelte";

    export let onMove: (direction: Direction) => void;
</script>

<div class={cn("w-full", $$restProps.class)}>
    <Tabs.Root value="location" class="w-full">
        <Tabs.List class="grid w-full grid-cols-3">
            <Tabs.Trigger value="location"><Map size={20} /></Tabs.Trigger>
            <Tabs.Trigger value="inventory"><Box size={20} /></Tabs.Trigger>
            <Tabs.Trigger value="build"><Hammer size={20} /></Tabs.Trigger>
        </Tabs.List>
        <!-- Location -->
        <Tabs.Content value="location">
            <Card.Root>
                <Card.Content class="py-2">
                    <div class="flex justify-between">
                        <ScrollArea class="h-[250px]">
                            <!-- Tile -->
                            <TileInfo></TileInfo>
                            <!-- Players -->
                            <PlayerList></PlayerList>
                            <!-- Monsters -->
                            <MonsterList></MonsterList>
                            <!-- Items -->
                            <ItemList></ItemList>
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
        <!-- Inventory -->
        <Tabs.Content value="inventory">
            <Inventory></Inventory>
        </Tabs.Content>
        <!-- Build -->
        <Tabs.Content value="build">
            <Tabs.Root value="build-options" class="w-full p-2">
                <Tabs.List class="grid w-full grid-cols-3">
                    <Tabs.Trigger value="basic"
                        ><BrickWall size={20} /></Tabs.Trigger
                    >
                    <Tabs.Trigger value="functional"
                        ><Landmark size={20} /></Tabs.Trigger
                    >
                    <Tabs.Trigger value="biome"
                        ><Trees size={20} /></Tabs.Trigger
                    >
                </Tabs.List>
                <!-- Location -->
                <Tabs.Content value="basic"></Tabs.Content>
                <!-- Inventory -->
                <Tabs.Content value="functional"></Tabs.Content>
                <!-- Build -->
                <Tabs.Content value="biome"></Tabs.Content>
            </Tabs.Root>
        </Tabs.Content>
    </Tabs.Root>
</div>

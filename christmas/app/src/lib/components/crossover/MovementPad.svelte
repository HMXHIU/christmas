<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Card from "$lib/components/ui/card/index.js";
    import type { Direction } from "$lib/crossover/world";
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
    } from "lucide-svelte";

    export let onMove: (direction: Direction) => void;
</script>

<div class={cn("w-full", $$restProps.class)}>
    <Card.Root>
        <Card.Content class="py-2">
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
                    on:click={() => onMove("n")}><ArrowUp size={20} /></Button
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
                    on:click={() => onMove("w")}><ArrowLeft size={20} /></Button
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
                    on:click={() => onMove("s")}><ArrowDown size={20} /></Button
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
        </Card.Content>
    </Card.Root>
</div>

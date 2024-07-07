<script lang="ts">
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Card from "$lib/components/ui/card/index.js";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Label } from "$lib/components/ui/label/index.js";
    import {
        abilities,
        type Abilities,
        type Ability,
    } from "$lib/crossover/world/abilities";
    import { cn } from "$lib/shadcn";
    import {
        Cog,
        Cross,
        Dumbbell,
        Grid2X2,
        Heart,
        Shield,
        Sparkles,
        Sword,
        Target,
        Zap,
    } from "lucide-svelte";

    import { playerAbilities } from "../../../store";

    let isDialogOpen = false;
    let selectedAbility: Ability | null = null;

    function openDialog(ability: Abilities) {
        selectedAbility = abilities[ability];
        isDialogOpen = true;
    }
</script>

<div class={cn("w-full", $$restProps.class)}>
    <Card.Root class="border-none">
        <Card.Content>
            <Label for="current">Abilities</Label>
            <div class="grid grid-cols-3 text-xs">
                {#if $playerAbilities.length > 0}
                    {#each $playerAbilities as ability (ability.ability)}
                        <Button
                            variant="link"
                            on:click={() => openDialog(ability.ability)}
                            >{ability.ability}</Button
                        >
                    {/each}
                {:else}
                    <p>No abilities</p>
                {/if}
            </div>
        </Card.Content>
    </Card.Root>

    <Dialog.Root bind:open={isDialogOpen}>
        <Dialog.Content class="sm:max-w-[425px]">
            <Dialog.Header>
                <Dialog.Title>{selectedAbility?.ability}</Dialog.Title>
                <Dialog.Description
                    >{selectedAbility?.description}</Dialog.Description
                >
            </Dialog.Header>
            <div class="flex flex-col gap-2">
                <div class="flex flex-row gap-2">
                    <Badge
                        class="
                        {selectedAbility?.type === 'healing'
                            ? 'bg-green-300'
                            : ''}
                        {selectedAbility?.type === 'offensive'
                            ? 'bg-red-300'
                            : ''}
                        {selectedAbility?.type === 'defensive'
                            ? 'bg-blue-300'
                            : ''}
                        {selectedAbility?.type === 'neutral'
                            ? 'bg-gray-300'
                            : ''}"
                    >
                        {#if selectedAbility?.type === "healing"}
                            <Cross class="h-4"></Cross>
                        {:else if selectedAbility?.type === "offensive"}
                            <Sword class="h-4"></Sword>
                        {:else if selectedAbility?.type === "defensive"}
                            <Shield class="h-4"></Shield>
                        {:else if selectedAbility?.type === "neutral"}
                            <Cog class="h-4"></Cog>
                        {/if}
                        {selectedAbility?.type}
                    </Badge>
                    <Badge>
                        <Target class="h-4"></Target>
                        {selectedAbility?.range}
                    </Badge>
                    <Badge>
                        <Grid2X2 class="h-4"></Grid2X2>
                        {selectedAbility?.aoe}
                    </Badge>
                </div>
                <div class="flex flex-row gap-2">
                    <Badge><Zap class="h-4"></Zap>{selectedAbility?.ap}</Badge>
                    <Badge class="bg-yellow-400"
                        ><Dumbbell class="h-4"
                        ></Dumbbell>{selectedAbility?.st}</Badge
                    >
                    <Badge class="bg-red-400"
                        ><Heart class="h-4"></Heart>{selectedAbility?.hp}</Badge
                    >
                    <Badge class="bg-blue-400"
                        ><Sparkles class="h-4"
                        ></Sparkles>{selectedAbility?.mp}</Badge
                    >
                </div>
            </div>
        </Dialog.Content>
    </Dialog.Root>
</div>

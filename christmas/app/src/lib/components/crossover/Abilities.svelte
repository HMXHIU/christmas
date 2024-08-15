<script lang="ts">
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Card from "$lib/components/ui/card/index.js";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Label } from "$lib/components/ui/label/index.js";
    import {
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

    import { abilities } from "$lib/crossover/world/settings/abilities";
    import { playerAbilities } from "../../../store";

    let isDialogOpen = false;
    let selectedAbility: Ability | null = null;

    function openDialog(ability: Abilities) {
        selectedAbility = abilities[ability];
        isDialogOpen = true;
    }

    // TODO: Need to add TICKS && procedures to abilities
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
                            class="h-6
                            {ability?.type === 'healing'
                                ? 'text-green-400'
                                : ''}
                            {ability?.type === 'offensive'
                                ? 'text-red-400'
                                : ''}
                            {ability?.type === 'defensive'
                                ? 'text-blue-400'
                                : ''}
                            {ability?.type === 'neutral'
                                ? 'text-gray-400'
                                : ''}"
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
                            ? 'bg-green-400'
                            : ''}
                        {selectedAbility?.type === 'offensive'
                            ? 'bg-red-400'
                            : ''}
                        {selectedAbility?.type === 'defensive'
                            ? 'bg-blue-400'
                            : ''}
                        {selectedAbility?.type === 'neutral'
                            ? 'bg-gray-400'
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
                    {#if selectedAbility?.aoe && selectedAbility?.aoe > 0}
                        <Badge>
                            <Grid2X2 class="h-4"></Grid2X2>
                            {selectedAbility?.aoe}
                        </Badge>
                    {/if}
                </div>
                <!-- Costs -->
                <div class="flex flex-row gap-2">
                    {#if selectedAbility?.ap && selectedAbility?.ap > 0}
                        <Badge
                            ><Zap class="h-4"></Zap>{selectedAbility?.ap}</Badge
                        >
                    {/if}
                    {#if selectedAbility?.st && selectedAbility?.st > 0}
                        <Badge class="bg-yellow-400"
                            ><Dumbbell class="h-4"
                            ></Dumbbell>{selectedAbility?.st}</Badge
                        >
                    {/if}
                    {#if selectedAbility?.hp && selectedAbility?.hp > 0}
                        <Badge class="bg-red-400"
                            ><Heart class="h-4"
                            ></Heart>{selectedAbility?.hp}</Badge
                        >
                    {/if}
                    {#if selectedAbility?.mp && selectedAbility?.mp > 0}
                        <Badge class="bg-blue-400"
                            ><Sparkles class="h-4"
                            ></Sparkles>{selectedAbility?.mp}</Badge
                        >
                    {/if}
                </div>
            </div>
        </Dialog.Content>
    </Dialog.Root>
</div>

<script lang="ts">
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Card from "$lib/components/ui/card/index.js";
    import * as Dialog from "$lib/components/ui/dialog";
    import {
        type Abilities,
        type Ability,
    } from "$lib/crossover/world/abilities";
    import { cn } from "$lib/shadcn";
    import {
        Brain,
        Cog,
        Cross,
        Grid2X2,
        Heart,
        Moon,
        Shield,
        Sun,
        Sword,
        Target,
        Zap,
    } from "lucide-svelte";

    import { abilities } from "$lib/crossover/world/settings/abilities";
    import { playerAbilities } from "../../../store";
    import { markdown } from "./Game/markdown";

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
        <Card.Content class="p-0 m-0">
            <div class="grid grid-cols-2 gap-2">
                {#if $playerAbilities.length > 0}
                    {#each $playerAbilities as ability (ability.ability)}
                        <Button
                            variant="link"
                            class="h-full whitespace-normal break-words text-left justify-start p-0 text-xs
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
                <Dialog.Description class="py-2"
                    >{@html markdown(
                        selectedAbility?.description,
                    )}</Dialog.Description
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
                <div class="flex flex-row space-2">
                    {#if selectedAbility?.cost.cha}
                        <Badge class="bg-teal-400"
                            ><Zap class="h-4"></Zap>{selectedAbility?.cost
                                .cha}</Badge
                        >
                    {/if}
                    {#if selectedAbility?.cost.mnd}
                        <Badge class="bg-blue-400"
                            ><Brain class="h-4"></Brain>{selectedAbility?.cost
                                .mnd}</Badge
                        >
                    {/if}
                    {#if selectedAbility?.cost.lum}
                        <Badge class="bg-yellow-400"
                            ><Sun class="h-4"></Sun>{selectedAbility?.cost
                                .lum}</Badge
                        >
                    {/if}
                    {#if selectedAbility?.cost.umb}
                        <Badge class="bg-purple-900"
                            ><Moon class="h-4"></Moon>{selectedAbility?.cost
                                .umb}</Badge
                        >
                    {/if}
                    {#if selectedAbility?.cost.hp}
                        <Badge class="bg-red-400"
                            ><Heart class="h-4"></Heart>{selectedAbility?.cost
                                .hp}</Badge
                        >
                    {/if}
                </div>
            </div>
        </Dialog.Content>
    </Dialog.Root>
</div>

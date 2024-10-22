<script lang="ts">
    import * as Card from "$lib/components/ui/card/index.js";
    import {
        entityAttributes,
        entitySkills,
    } from "$lib/crossover/world/entity";
    import { cn } from "$lib/shadcn";
    import { player } from "../../../store";
    import SeparatorWithText from "../common/SeparatorWithText.svelte";

    $: attributes = $player && entityAttributes($player);
    $: skills = ($player && entitySkills($player)) || {};
</script>

<div class={cn("w-full", $$restProps.class)}>
    <Card.Root class="border-none">
        <Card.Content class="p-0 m-0 ">
            <div class="grid grid-cols-1 gap-2">
                <div class="grid gap-2 content-start">
                    <SeparatorWithText>Character</SeparatorWithText>
                    <div class="p-2 text-left">
                        <p class="text-xs">
                            <span class="font-bold">Name:</span>
                            {$player?.name}
                        </p>
                        <p class="text-xs">
                            <span class="font-bold">Race:</span>
                            {$player?.race}
                        </p>
                        <p class="text-xs">
                            <span class="font-bold">Gender:</span>
                            {$player?.gen}
                        </p>
                    </div>
                    <SeparatorWithText>Attributes</SeparatorWithText>
                    <div class="p-2 text-left">
                        <p class="text-xs">
                            <span class="font-bold">Strength:</span>
                            {attributes?.str ?? 0}
                        </p>
                        <p class="text-xs">
                            <span class="font-bold">Dexterity:</span>
                            {attributes?.dex ?? 0}
                        </p>
                        <p class="text-xs">
                            <span class="font-bold">Constitution:</span>
                            {attributes?.con ?? 0}
                        </p>
                        <p class="text-xs">
                            <span class="font-bold">Mind:</span>
                            {attributes?.mnd ?? 0}
                        </p>
                        <p class="text-xs">
                            <span class="font-bold">Faith:</span>
                            {attributes?.fth ?? 0}
                        </p>
                        <p class="text-xs">
                            <span class="font-bold">Chaos:</span>
                            {attributes?.cha ?? 0}
                        </p>
                    </div>
                    <SeparatorWithText>Skills</SeparatorWithText>
                    <div class="p-2 text-left">
                        {#each Object.entries(skills) as [skill, level]}
                            <p class="text-xs">
                                <span class="font-bold">{skill}:</span>
                                {level ?? 0}
                            </p>
                        {/each}
                    </div>
                </div>
            </div>
        </Card.Content>
    </Card.Root>
</div>

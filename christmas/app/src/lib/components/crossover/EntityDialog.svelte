<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog";
    import type { EntityType } from "$lib/crossover/types";
    import { get } from "svelte/store";
    import { itemRecord, monsterRecord, playerRecord } from "../../../store";
    import CreatureDialog from "./CreatureDialog.svelte";
    import ItemDialog from "./ItemDialog.svelte";

    export let open = false;
    export let entityId: string;
    export let entityType: EntityType;
</script>

{#if entityType === "item" && entityId != null}
    <ItemDialog item={get(itemRecord)[entityId]} bind:open></ItemDialog>
{:else if (entityType === "monster" || entityType === "player") && entityId != null}
    <CreatureDialog
        creature={entityType === "monster"
            ? get(monsterRecord)[entityId]
            : get(playerRecord)[entityId]}
        bind:open
    ></CreatureDialog>
{:else}
    <!-- Unknown entity -->
    <Dialog.Root bind:open>
        <Dialog.Content class="sm:max-w-[425px]">
            <Dialog.Header>
                <Dialog.Title>Forbidden Knowledge</Dialog.Title>
                <Dialog.Description class="py-2"
                    >You have no knowledge of {entityId}</Dialog.Description
                >
            </Dialog.Header>
        </Dialog.Content>
    </Dialog.Root>
{/if}

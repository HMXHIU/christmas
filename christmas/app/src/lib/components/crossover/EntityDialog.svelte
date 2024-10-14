<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog";
    import type { EntityType } from "$lib/crossover/types";
    import { get } from "svelte/store";
    import { itemRecord } from "../../../store";
    import ItemDialog from "./ItemDialog.svelte";

    export let open = false;
    export let entityId: string;
    export let entityType: EntityType;

    $: item =
        entityType === "item" && entityId != null && get(itemRecord)[entityId];
</script>

{#if item}
    <ItemDialog {item} bind:open></ItemDialog>
{:else}
    <!-- Unknown entity -->
    <Dialog.Root bind:open>
        <Dialog.Content class="sm:max-w-[425px]">
            <Dialog.Header>
                <Dialog.Title>{entityId}</Dialog.Title>
                <Dialog.Description class="py-2"
                    >You have no knowledge of {entityId}</Dialog.Description
                >
            </Dialog.Header>
        </Dialog.Content>
    </Dialog.Root>
{/if}

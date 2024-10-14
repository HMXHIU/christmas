<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog";
    import type { Creature, Monster } from "$lib/crossover/types";
    import { getEntityId } from "$lib/crossover/utils";
    import { bestiary } from "$lib/crossover/world/settings/bestiary";
    import CopyToClipboard from "./CopyToClipboard.svelte";

    export let creature: Creature;
    export let open = false;

    $: [creatureId, creatureType] = creature && getEntityId(creature);

    function creatureDescription() {
        if (creatureType === "monster") {
            const beast = (creature as Monster).beast;
            return bestiary[beast].description;
        }
        return "";
    }
</script>

<Dialog.Root bind:open openFocus={"#grab-focus-from-tooltip"}>
    <Dialog.Content class="sm:max-w-[425px]" id="grab-focus-from-tooltip">
        <!-- Creature Name & Description -->
        <Dialog.Header>
            <Dialog.Title
                ><span>
                    <CopyToClipboard text={creatureId}></CopyToClipboard>
                </span>{creature.name}
            </Dialog.Title>
            <Dialog.Description class="py-2"
                >{creatureDescription()}</Dialog.Description
            >
        </Dialog.Header>
    </Dialog.Content>
</Dialog.Root>

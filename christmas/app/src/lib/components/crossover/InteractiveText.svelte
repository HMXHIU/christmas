<script lang="ts">
    import type { EntityType } from "$lib/crossover/types";
    import { createEventDispatcher } from "svelte";
    import { markdown } from "./Game/markdown";
    import type { EntityLink } from "./types";

    export let text: string = "";

    const dispatch = createEventDispatcher();

    $: markdownText = markdown(text);
    $: enrichedText = enrichWithEntities(markdownText);

    /*
    Replace with button which emit `entityLink` event for the following:

    Entity IDs:
        item_xxx, monster_xxx -> regex match item_*

    Names/Descriptor links (use {} because [] is used for links):
        {Inn Keeper}(player:npc/xxx)
        {Gandalf}(player:xxx)
        {Potion Of Health}(item:xxx)
    */

    function enrichWithEntities(t: string) {
        return t
            .replace(
                /\{([^}]+)\}\[(\w+):([^\]]+)\]/g,
                (match, entityName, entityType, entityId) => {
                    return `<button class="entity-link underline" data-entity="${entityId}" data-entity-type="${entityType}">${entityName}</button>`;
                },
            )
            .replace(/(?<=^|\s)(item_\w+)\b/g, (match, itemId) => {
                return `<button class="entity-link underline" data-entity="${itemId}" data-entity-type="item">${itemId}</button>`;
            });
    }

    function onClickLink(event: MouseEvent) {
        const eventTarget = event.target;
        if (
            eventTarget instanceof HTMLElement &&
            eventTarget.classList.contains("entity-link")
        ) {
            const entityLink: EntityLink = {
                entityType: eventTarget.dataset.entityType! as EntityType,
                entityId: eventTarget.dataset.entity!,
            };
            dispatch("entityLink", entityLink);
        }
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div on:click={onClickLink}>
    {@html enrichedText}
</div>

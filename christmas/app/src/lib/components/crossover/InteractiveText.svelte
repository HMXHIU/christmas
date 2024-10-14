<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { markdown } from "./Game/markdown";
    import type { EntityLink } from "./types";

    export let text: string = "";

    const dispatch = createEventDispatcher();

    $: markdownText = markdown(text);
    $: enrichedText = enrichWithEntities(markdownText);

    function enrichWithEntities(t: string) {
        return t.replace(/\b(item_\w+)\b/g, (match, itemId) => {
            return `<button class="item-link underline" data-item="${itemId}">${itemId}</button>`;
        });
    }

    function onClickLink(event: MouseEvent) {
        const eventTarget = event.target;
        if (
            eventTarget instanceof HTMLElement &&
            eventTarget.classList.contains("item-link")
        ) {
            const entityLink: EntityLink = {
                entityType: "item",
                entityId: eventTarget.dataset.item!,
            };

            dispatch("entityLink", entityLink);
        }
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div on:click={onClickLink}>
    {@html enrichedText}
</div>

<script lang="ts">
    import { markdown } from "./Game/markdown";

    export let text: string = "";

    $: markdownText = markdown(text);
    $: enrichedText = enrichWithEntities(markdownText);

    function enrichWithEntities(t: string) {
        return t.replace(/\b(item_\w+)\b/g, (match, itemName) => {
            return `<button class="item-link underline" data-item="${itemName}">${itemName}</button>`;
        });
    }

    function handleItemClick(event: MouseEvent) {
        const eventTarget = event.target;
        if (
            eventTarget instanceof HTMLElement &&
            eventTarget.classList.contains("item-link")
        ) {
            const itemName = eventTarget.dataset.item;
            console.log("CLICKED", itemName);
        }
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div on:click={handleItemClick}>
    {@html enrichedText}
</div>

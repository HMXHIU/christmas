<script lang="ts">
    import { compendium } from "$lib/crossover/world/settings/compendium";
    import type { Item } from "$lib/server/crossover/redis/entities";
    import { groupBy } from "lodash";
    import { itemRecord } from "../../../store";

    $: environmentItems = groupBy(
        Object.values($itemRecord).filter((item) => item.locT === "geohash"),
        "prop",
    );

    function getIndefiniteArticle(word: string): string {
        return ["a", "e", "i", "o", "u"].includes(word[0].toLowerCase())
            ? "an"
            : "a";
    }

    function getItemDescription(prop: string, items: Item[]): string {
        const itemName = compendium[prop].defaultName.toLowerCase();
        const count = items.length;
        let description = "";

        if (count === 1) {
            description = `${getIndefiniteArticle(itemName)} <b>${itemName}</b>`;
        } else {
            description = `${count} <b>${itemName}s</b>`;
        }

        // Add additional details
        if (compendium[prop].weight < 0) {
            description += ` firmly fixed in place`;
        }
        if (count > 5) {
            description += ` (an unusually large number)`;
        }

        return description;
    }

    function getEnvironmentDescription(items: [string, Item[]][]): string {
        if (items.length === 0) return "There are no items of note here.";

        if (items.length === 1) {
            const [prop, itemArray] = items[0];
            return `You see ${getItemDescription(prop, itemArray)}.`;
        }

        const itemDescriptions = items.map(([prop, itemArray]) =>
            getItemDescription(prop, itemArray),
        );

        if (items.length === 2) {
            return `You see ${itemDescriptions[0]} and ${itemDescriptions[1]}.`;
        }

        const lastItem = itemDescriptions.pop();
        return `You see ${itemDescriptions.join(", ")}, and ${lastItem}.`;
    }
</script>

{#if Object.keys(environmentItems).length > 0}
    <p class="text-sm text-sky-400">
        {@html getEnvironmentDescription(Object.entries(environmentItems))}
    </p>
{/if}

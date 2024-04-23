<script lang="ts">
    import * as Avatar from "$lib/components/ui/avatar";
    import { player } from "../../../store";
    import APBars from "./APBars.svelte";
    import ResourceBars from "./ResourceBars.svelte";

    // TODO: Use player actual portrait
</script>

<!-- Page Footer -->
<footer class="py-3 fixed w-full bottom-0 z-50 bg-secondary pl-2">
    <!-- Player Info -->
    <div class="relative h-0 flex justify-center md:bottom-14 bottom-10">
        <!-- Player Avatar -->
        <Avatar.Root class="h-16 w-16 sm:min-h-20 sm:min-w-20">
            <Avatar.Image
                src="/sprites/portraits/female_drow.jpeg"
                alt={$player?.name}
            />
            <Avatar.Fallback>{$player?.name.slice(0, 2)}</Avatar.Fallback>
        </Avatar.Root>
    </div>
    <div class="relative h-0 flex justify-center md:bottom-14 bottom-10">
        <APBars class="h-16 w-16 sm:min-h-20 sm:min-w-20"></APBars>
    </div>
    <div class="relative h-0 flex justify-center md:bottom-14 bottom-10">
        <ResourceBars class="h-16 w-16 sm:min-h-20 sm:min-w-20"></ResourceBars>
    </div>
    <!-- Other Info -->
    <div class="grid grid-cols-4 justify-center h-6"></div>
</footer>

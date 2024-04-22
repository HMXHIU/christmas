<script lang="ts">
    import * as Avatar from "$lib/components/ui/avatar";
    import { player } from "../../../store";
    import ResourceBars from "./ResourceBars.svelte";

    // TODO: Use player actual portrait
</script>

<!-- Page Footer -->
<footer class="py-3 fixed w-full bottom-0 z-50 bg-secondary pl-2">
    <!-- Player Info -->
    <div class="relative h-0 flex justify-center bottom-12">
        <!-- Player Avatar -->
        <Avatar.Root class="h-20 w-20">
            <Avatar.Image
                src="/sprites/portraits/female_drow.jpeg"
                alt={$player?.name}
            />
            <Avatar.Fallback>{$player?.name.slice(0, 2)}</Avatar.Fallback>
        </Avatar.Root>
    </div>
    <div class="relative h-0 flex justify-center bottom-12">
        <ResourceBars></ResourceBars>
    </div>

    <div class="grid grid-cols-4 justify-center h-6"></div>
</footer>

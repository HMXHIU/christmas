<script lang="ts">
    import * as Avatar from "$lib/components/ui/avatar";
    import * as Drawer from "$lib/components/ui/drawer";
    import { Box } from "lucide-svelte";
    import { player } from "../../../store";
    import APBars from "./APBars.svelte";
    import BusyBar from "./BusyBar.svelte";
    import Inventory from "./Inventory.svelte";
    import ResourceBars from "./ResourceBars.svelte";
</script>

<!-- Page Footer -->
{#if $player}
    <footer class="py-0 fixed w-full bottom-0 z-50 bg-secondary h-12">
        <!-- Player Info -->
        <div
            class="relative h-0 flex justify-center md:bottom-11 sm:bottom-11 bottom-6"
        >
            <!-- Player Avatar -->
            <Avatar.Root class="h-16 w-16 sm:min-h-20 sm:min-w-20">
                <div class="bg-secondary">
                    <div class="avatar-image">
                        <Avatar.Image
                            src={$player?.avatar}
                            alt={$player?.name}
                        />
                    </div>
                </div>
                <Avatar.Fallback>{$player?.name.slice(0, 2)}</Avatar.Fallback>
            </Avatar.Root>
        </div>

        <!-- Busy -->
        <div
            class="relative h-0 flex justify-center md:bottom-11 sm:bottom-11 bottom-6"
        >
            <BusyBar class="h-16 w-16 sm:min-h-20 sm:min-w-20"></BusyBar>
        </div>
        <!-- AP -->
        <div
            class="relative h-0 flex justify-center md:bottom-11 sm:bottom-11 bottom-6"
        >
            <APBars class="h-16 w-16 sm:min-h-20 sm:min-w-20"></APBars>
        </div>
        <!-- HP, MP, ST -->
        <div
            class="relative h-0 flex justify-center md:bottom-11 sm:bottom-11 bottom-6"
        >
            <ResourceBars class="h-16 w-16 sm:min-h-20 sm:min-w-20"
            ></ResourceBars>
        </div>
        <!-- Inventory -->
        <div class="grid grid-cols-3 place-items-center h-full">
            <!-- Inventory -->
            <Drawer.Root>
                <Drawer.Trigger><Box /></Drawer.Trigger>
                <Drawer.Content>
                    <Inventory></Inventory>
                    <Drawer.Footer>
                        <Drawer.Close>Close</Drawer.Close>
                    </Drawer.Footer>
                </Drawer.Content>
            </Drawer.Root>
            <div></div>
            <div></div>
        </div>
    </footer>
{/if}

<style>
    .avatar-image {
        margin-top: -15px;
        margin-left: -22px;
        width: 128px;
        height: 256px;
    }
</style>

<script lang="ts">
    import { cn } from "$lib/shadcn";
    import ItemList from "./ItemList.svelte";
    import MonsterList from "./MonsterList.svelte";
    import PlayerList from "./PlayerList.svelte";
    import TileInfo from "./TileInfo.svelte";
</script>

<div class={cn("w-full flex flex-col gap-2", $$restProps.class)}>
    <!-- Tile -->
    <TileInfo></TileInfo>
    <!-- Players -->
    <PlayerList></PlayerList>
    <!-- Monsters -->
    <MonsterList></MonsterList>
    <!-- Items -->
    <ItemList></ItemList>
</div>

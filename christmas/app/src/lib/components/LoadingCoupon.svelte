<script lang="ts">
    import { Skeleton } from "$lib/components/ui/skeleton";
</script>

<div class="h-full flex items-center space-x-4 overflow-hidden">
    <Skeleton class="h-12 w-12 rounded-full" />
    <div class="space-y-4">
        <Skeleton class="h-4 w-[250px]" />
        <Skeleton class="h-4 w-[200px]" />
        <Skeleton class="h-4 w-[250px]" />
        <Skeleton class="h-4 w-[250px]" />
        <Skeleton class="h-4 w-[200px]" />
        <Skeleton class="h-4 w-[200px]" />
    </div>
</div>

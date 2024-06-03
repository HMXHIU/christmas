<script lang="ts">
    import { Label } from "$lib/components/ui/label";
    import { cn } from "$lib/shadcn";

    export let label: string = "";
</script>

<div class={cn("grid w-full gap-2", $$restProps.class)}>
    <Label class="text-muted-foreground text-xs">{label}</Label>
    <slot></slot>
</div>

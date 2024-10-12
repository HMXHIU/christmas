<script lang="ts">
    import { flyAndScale } from "$lib/shadcn";
    import { Tooltip } from "bits-ui";
    export let text: string;
</script>

<Tooltip.Root openDelay={0}>
    <Tooltip.Trigger>
        <slot></slot>
    </Tooltip.Trigger>
    <Tooltip.Content
        transition={flyAndScale}
        transitionConfig={{ y: 8, duration: 150 }}
        sideOffset={8}
    >
        <div
            class="flex items-center justify-center rounded-input border border-dark-10 bg-background p-3 text-sm font-medium shadow-popover outline-none"
        >
            {text}
        </div>
    </Tooltip.Content>
</Tooltip.Root>

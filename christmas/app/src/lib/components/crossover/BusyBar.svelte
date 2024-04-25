<script lang="ts">
    import { MS_PER_TICK } from "$lib/crossover/world/settings";
    import { cn } from "$lib/shadcn";
    import { onMount } from "svelte";
    import { player } from "../../../store";

    let speed = 0;
    let progress = 0;

    onMount(() => {
        const unsubscribe = player.subscribe((p) => {
            if (p != null) {
                const busyMs = p.buclk - Date.now();
                if (busyMs > 0) {
                    speed = 100 / (busyMs / MS_PER_TICK);
                    progress = 100;
                } else {
                    speed = 0;
                    progress = 0;
                }
            }
        });

        // Count down the busy time
        const timer = setInterval(() => {
            if (progress > 0) {
                progress = Math.max(progress - speed, 0);
            }
        }, MS_PER_TICK);

        return () => {
            unsubscribe();
            clearInterval(timer);
        };
    });
</script>

<div class={cn("w-20 h-20", $$restProps.class)}>
    <svg viewBox="0 0 100 100" class={cn("circular-progress overflow-visible")}>
        <circle class="busy" style="--progress: {progress};"></circle>
    </svg>
</div>

<style>
    .circular-progress {
        --size: 100px;
        --half-size: calc(var(--size) / 2);
        --stroke-width: 6px;
        --radius: calc((var(--size) + var(--stroke-width) * 2) / 2);
        --circumference: calc(var(--radius) * pi * 2);
        animation: progress-animation 5s linear 0s 1 forwards;
    }

    .circular-progress circle {
        cx: var(--half-size);
        cy: var(--half-size);
        r: var(--radius);
        stroke-width: var(--stroke-width);
        fill: none;
        stroke-linecap: square;
    }

    .circular-progress circle.busy {
        --dash: calc((var(--progress) * var(--circumference)) / 100);
        transform-origin: var(--half-size) var(--half-size);
        stroke-dasharray: var(--dash) calc(var(--circumference) - var(--dash));
        transition: stroke-dasharray 0.3s linear 0s;
        transform: rotate(-90deg);
        stroke: #fd5353;
    }
</style>

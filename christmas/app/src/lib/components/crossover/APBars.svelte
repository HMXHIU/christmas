<script lang="ts">
    import { playerStats } from "$lib/crossover/world/player";
    import { MS_PER_TICK, TICKS_PER_TURN } from "$lib/crossover/world/settings";
    import { cn } from "$lib/shadcn";
    import { onMount } from "svelte";
    import { player } from "../../../store";

    let maxAp = 0;
    let apProgress = 0;
    let recoveryRate = 0;

    onMount(() => {
        const unsubscribe = player.subscribe((p) => {
            if (p != null) {
                const stats = playerStats({ level: p.level });
                maxAp = stats.ap;
                apProgress = (p.ap / maxAp || 0) * 100;
                recoveryRate = 100 / (maxAp * TICKS_PER_TURN);
            }
        });

        // Preemptively recover AP over time (client side)
        const apTimer = setInterval(() => {
            if (apProgress < 100) {
                apProgress = Math.min(apProgress + recoveryRate, 100);
            }
        }, MS_PER_TICK);

        return () => {
            unsubscribe();
            clearInterval(apTimer);
        };
    });
</script>

<div class={cn("w-20 h-20", $$restProps.class)}>
    <svg viewBox="0 0 100 100" class={cn("circular-progress overflow-visible")}>
        <circle class="bg" style="--stroke-width: 6px;"></circle>
        <circle class="ap" style="--progress: {apProgress};"></circle>
        <circle
            class="dividers"
            style="--bars: {maxAp * 2}; --stroke-width: 6px;"
        ></circle>
    </svg>
</div>

<style>
    .circular-progress {
        --size: 100px;
        --half-size: calc(var(--size) / 2);
        --stroke-width: 4px;
        --radius: calc((var(--size) + var(--stroke-width) * 2.5) / 2);
        --circumference: calc(var(--radius) * pi * 2);
        animation: progress-animation 5s linear 0s 1 forwards;
    }

    .circular-progress circle {
        cx: var(--half-size);
        cy: var(--half-size);
        r: var(--radius);
        stroke-width: var(--stroke-width);
        stroke-linecap: square;
        fill: none;
    }

    .circular-progress circle.bg {
        --dash: calc((var(--progress) * var(--circumference)) / 100);
        transform-origin: var(--half-size) var(--half-size);
        transition: stroke-dasharray 0.3s linear 0s;
        stroke: hsl(var(--background) / var(--tw-bg-opacity));
    }

    .circular-progress circle.ap {
        --dash: calc((var(--progress) * var(--circumference)) / 100);
        transform-origin: var(--half-size) var(--half-size);
        stroke-dasharray: var(--dash) calc(var(--circumference) - var(--dash));
        transition: stroke-dasharray 0.3s linear 0s;
        stroke: #e2e2e2;
    }

    .circular-progress circle.dividers {
        --dash: calc((var(--progress) * var(--circumference)) / 100);
        transform-origin: var(--half-size) var(--half-size);
        stroke-dasharray: calc(var(--circumference) / var(--bars))
            calc(var(--circumference) / var(--bars));
        transition: stroke-dasharray 0.3s linear 0s;
        stroke: hsl(var(--background) / var(--tw-bg-opacity));
    }
</style>

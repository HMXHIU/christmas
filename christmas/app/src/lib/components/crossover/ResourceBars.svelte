<script lang="ts">
    import { playerStats } from "$lib/crossover/world/player";
    import { cn } from "$lib/shadcn";
    import { onMount } from "svelte";
    import { player } from "../../../store";

    // TODO: display hp/maxHp on hover
    let maxHp = 0;
    let maxMp = 0;
    let maxSt = 0;

    let hpProgress = 0;
    let mpProgress = 0;
    let stProgress = 0;

    onMount(() => {
        const unsubscribe = player.subscribe((p) => {
            if (p != null) {
                const stats = playerStats({ level: p.level });

                maxHp = stats.hp;
                maxMp = stats.mp;
                maxSt = stats.st;
                hpProgress = Math.max((p.hp / maxHp) * 33.33 || 0, 33.33);
                mpProgress = Math.max((p.mp / maxMp) * 33.33 || 0, 33.33);
                stProgress = Math.max((p.st / maxSt) * 33.33 || 0, 33.33);
            }
        });

        return unsubscribe;
    });
</script>

<div>
    <svg
        viewBox="0 0 100 100"
        class={cn("circular-progress w-20 h-20", $$restProps.class)}
    >
        <circle class="bg"></circle>
        <circle class="hp" style="--progress: {hpProgress};"></circle>
        <circle class="mp" style="--progress: {mpProgress};"></circle>
        <circle class="st" style="--progress: {stProgress};"></circle>
    </svg>
</div>

<style>
    .circular-progress {
        --size: 100px;
        --half-size: calc(var(--size) / 2);
        --stroke-width: 3px;
        --radius: calc((var(--size) - var(--stroke-width)) / 2);
        --circumference: calc(var(--radius) * pi * 2);
        animation: progress-animation 5s linear 0s 1 forwards;
    }

    .circular-progress circle {
        cx: var(--half-size);
        cy: var(--half-size);
        r: var(--radius);
        stroke-width: var(--stroke-width);
        fill: none;
        stroke-linecap: round;
    }

    .circular-progress circle.hp,
    .circular-progress circle.mp,
    .circular-progress circle.st {
        --dash: calc((var(--progress) * var(--circumference)) / 100);
        transform-origin: var(--half-size) var(--half-size);
        stroke-dasharray: var(--dash) calc(var(--circumference) - var(--dash));
        transition: stroke-dasharray 0.3s linear 0s;
    }

    .circular-progress circle.bg {
        stroke: #ddd;
    }

    .circular-progress circle.mp {
        transform: rotate(90deg);
        stroke: #5394fd;
    }
    .circular-progress circle.hp {
        transform: rotate(210deg);
        stroke: #fd5353;
    }
    .circular-progress circle.st {
        transform: rotate(-30deg);
        stroke: #f4fd53;
    }
</style>

<!-- src/App.svelte -->
<script lang="ts">
    import { gsap } from "gsap";
    import { PixiPlugin } from "gsap/PixiPlugin";
    import { onMount } from "svelte";
    import { Avatar } from "../../app/src/lib/components/crossover/avatar/Avatar";
    import type {
        Animation,
        Pose,
    } from "../../app/src/lib/components/crossover/avatar/types";
    import {
        default as AnimationCanvas,
        default as Canvas,
    } from "./lib/components/AnimationCanvas.svelte";
    import ControlPanel from "./lib/components/ControlPanel.svelte";
    import Timeline from "./lib/components/Timeline.svelte";
    import { avatar } from "./lib/store";

    // Register GSAP PixiPlugin
    gsap.registerPlugin(PixiPlugin);

    let selectedAnimation: Animation | null;
    let selectedPose: Pose | null;
    let canvasComponent: Canvas;
    let currentTime: number;

    onMount(() => {
        avatar.set(
            new Avatar({
                depthStart: 0,
                depthScale: 1,
                depthLayer: 0,
            }),
        );
    });
</script>

<main class="w-full h-screen flex flex-col bg-gray-200">
    <div class="flex flex-row h-4/5">
        <div class="w-[280px]">
            <ControlPanel bind:selectedAnimation bind:selectedPose />
        </div>
        <AnimationCanvas
            bind:this={canvasComponent}
            {selectedAnimation}
            {selectedPose}
            {currentTime}
        />
    </div>
    <div class="flex flex-row h-1/5">
        <Timeline
            animation={selectedAnimation}
            pose={selectedPose}
            bind:currentTime
        />
    </div>
</main>

<style>
    :global(body) {
        margin: 0;
        padding: 0;
        overflow: hidden;
    }
</style>

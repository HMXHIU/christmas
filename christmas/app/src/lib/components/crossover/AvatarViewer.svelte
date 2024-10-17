<script lang="ts">
    import { GAME_MORPHOLOGY } from "$lib/crossover/defs";
    import { cn } from "$lib/shadcn";
    import { Application, Container, WebGLRenderer } from "pixi.js";
    import { onMount } from "svelte";
    import { Avatar } from "./avatar/Avatar";
    import type { AnimationMetadata, AvatarMetadata } from "./avatar/types";
    import { layers } from "./Game/layers";

    export let metadata: {
        avatarMetadata: AvatarMetadata;
        animationMetadata: AnimationMetadata;
        pose?: string;
    };

    export let anchor: { x: number; y: number } = { x: 0, y: 0 };
    export let scale: number = 1;
    export let entityId: string;

    let containerElement: HTMLDivElement;
    let app: Application | null = null;
    let stage: Container | null = null;
    let avatar: Avatar;
    let clientHeight: number;
    let clientWidth: number;
    let isInitialized: boolean = false;

    $: resize(clientHeight, clientWidth);
    $: updateAvatar(metadata);

    function resize(height: number, width: number) {
        if (!app || !stage || !isInitialized) {
            return;
        }
        app.renderer.resize(width, height);
        stage.pivot = { x: -width / 2, y: -height / 2 };
    }

    async function updateAvatar({
        avatarMetadata,
        animationMetadata,
        pose,
    }: {
        avatarMetadata: AvatarMetadata;
        animationMetadata: AnimationMetadata;
        pose?: string;
    }) {
        if (!app || !stage || !isInitialized) {
            return;
        }

        // Create avatar from metadata
        avatar = new Avatar(layers.depthPartition("entity")); // just need to be a negative small number
        await avatar.loadFromMetadata(
            avatarMetadata,
            entityId,
            GAME_MORPHOLOGY,
        );

        // Load humanoid animation and pose
        avatar.animationManager.load(animationMetadata);
        await avatar.pose(avatar.animationManager.getPose(pose ?? "default"));
        avatar.updateDepth(1);

        stage.removeChildren();
        stage.addChild(avatar);

        // Focus on face
        avatar.scale.set(scale);
        const bounds = avatar.getBounds();
        avatar.y = bounds.height * anchor.y;
        avatar.x = bounds.height * anchor.x;

        resize(clientHeight, clientWidth);
    }

    async function init() {
        app = new Application();
        stage = new Container();
        await app.init({
            antialias: false,
            preference: "webgl",
        });

        app.stage.addChild(stage);
        containerElement.appendChild(app.canvas);

        // Set up depth test
        const gl = (app.renderer as WebGLRenderer).gl;
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.depthMask(true);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.clearDepth(1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        isInitialized = true;

        // HMR
        if (metadata) {
            updateAvatar(metadata);
            resize(containerElement.clientHeight, containerElement.clientWidth);
        }
    }

    onMount(() => {
        // Initialize
        init();
    });
</script>

<div class="h-full w-full" bind:clientHeight bind:clientWidth>
    <div
        class={cn("overflow-hidden", $$restProps.class)}
        bind:this={containerElement}
    ></div>
</div>

<script lang="ts">
    import { avatarMorphologies } from "$lib/crossover/world/bestiary";
    import { cn } from "$lib/shadcn";
    import { Application, Assets, Container } from "pixi.js";
    import { onMount } from "svelte";
    import { Avatar } from "./avatar/Avatar";

    export let avatarTextures: Record<string, string>;

    let containerElement: HTMLDivElement;
    let app: Application | null = null;
    let stage: Container | null = null;
    let avatar: Avatar;
    let clientHeight: number;
    let clientWidth: number;
    let isInitialized: boolean = false;

    $: resize(clientHeight, clientWidth);
    $: updateAvatar(avatarTextures);

    function resize(height: number, width: number) {
        if (!app || !stage || !isInitialized) {
            return;
        }
        app.renderer.resize(width, height);
        stage.pivot = { x: -width / 2, y: -height / 2 };
    }

    async function updateAvatar(avatarTextures: Record<string, string>) {
        if (!app || !stage || !isInitialized) {
            return;
        }
        const morphology = avatarMorphologies["humanoid"];

        // Load humanoid avatar metadata and replace textures
        const avatarMetadata = {
            ...(await Assets.load(morphology.avatar)),
            textures: avatarTextures,
        };

        // Create avatar from metadata
        avatar = new Avatar();
        await avatar.loadFromMetadata(avatarMetadata);

        // Load humanoid animation and pose
        avatar.animationManager.load(await Assets.load(morphology.animation));
        await avatar.pose(avatar.animationManager.getPose("default"));
        avatar.updateDepth(0);

        stage.removeChildren();
        stage.addChild(avatar);

        // Focus on face
        avatar.scale.set(1.8);
        const bounds = avatar.getBounds();
        avatar.y = bounds.height * 0.825;

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

        isInitialized = true;

        // HMR
        if (avatarTextures) {
            updateAvatar(avatarTextures);
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

<script lang="ts">
    import { avatarMorphologies } from "$lib/crossover/world/bestiary";
    import { cn } from "$lib/shadcn";
    import { Application, Assets, Container, WebGLRenderer } from "pixi.js";
    import { onMount } from "svelte";
    import { Avatar } from "./avatar/Avatar";

    export let textures: Record<string, string>;

    let containerElement: HTMLDivElement;
    let app: Application | null = null;
    let stage: Container | null = null;
    let avatar: Avatar;
    let clientHeight: number;
    let clientWidth: number;
    let isInitialized: boolean = false;

    $: resize(clientHeight, clientWidth);
    $: updateAvatar(textures);

    function resize(height: number, width: number) {
        if (!app || !stage || !isInitialized) {
            return;
        }
        app.renderer.resize(width, height);
        stage.pivot = { x: -width / 2, y: -height / 2 };
    }

    async function updateAvatar(textures: Record<string, string>) {
        if (!app || !stage || !isInitialized) {
            return;
        }
        const morphology = avatarMorphologies["humanoid"];

        // Load humanoid avatar metadata and replace textures
        const avatarMetadata = {
            ...(await Assets.load(morphology.avatar)),
            textures: textures,
        };

        // Create avatar from metadata
        avatar = new Avatar({ renderLayer: 1, zScale: -0.00001 }); // just need to be a negative small number
        await avatar.loadFromMetadata(avatarMetadata);

        // Load humanoid animation and pose
        avatar.animationManager.load(await Assets.load(morphology.animation));
        await avatar.pose(avatar.animationManager.getPose("default"));
        avatar.updateDepth(1);

        stage.removeChildren();
        stage.addChild(avatar);

        // Focus on face
        avatar.scale.set(1.8);
        const bounds = avatar.getBounds();
        avatar.y = bounds.height * 0.9;

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
        if (textures) {
            updateAvatar(textures);
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

<!-- src/lib/components/BonePositioningCanvas.svelte -->
<script lang="ts">
    import { Application, Assets, Sprite, Texture } from "pixi.js";
    import { createEventDispatcher, onDestroy, onMount } from "svelte";
    import type { Bone } from "../../../../app/src/lib/components/crossover/avatar/Bone";
    import { BoneGraphic } from "../BoneGraphic";
    import { avatar } from "../store";

    export let selectedBone: Bone | null = null;

    const dispatch = createEventDispatcher();

    let app: Application;
    let canvasElement: HTMLDivElement;
    let sprite: Sprite | null = null;
    let boneGraphic: BoneGraphic | null = null;
    let isInitialized = false;
    let textureWidth = 0;
    let textureHeight = 0;

    let dragging = false;
    let rotating = false;
    let scaling = false;
    let dragStartPosition = { x: 0, y: 0 };
    let originalPosition = { x: 0, y: 0 };
    let rotationStartAngle = 0;
    let rotationCenter = { x: 0, y: 0 };
    let lengthStartPosition = { x: 0, y: 0 };
    let originalLength = 0;

    $: updateCanvas(selectedBone);

    async function init() {
        app = new Application();
        await app.init({
            width: 512,
            height: 512,
            backgroundColor: 0xaaaaaa,
        });

        canvasElement.appendChild(app.canvas);
        isInitialized = true;
    }

    onMount(() => {
        init();
    });

    onDestroy(() => {
        app.destroy(true, { children: true, texture: true });
    });

    async function updateCanvas(selectedBone: Bone | null) {
        if (!app || !isInitialized || $avatar == null) return;

        // Clear previous content
        app.stage.removeChildren();

        if (!selectedBone) {
            return;
        }

        const textures = $avatar.metadata?.textures;
        if (!textures) return;

        const selectedTexture = selectedBone.textureKey;

        // pivotBone has no texture
        if (selectedTexture == null) {
            return;
        }

        // Load and display texture (sprite)
        const textureUrl = textures[selectedTexture];
        const texture = (await Assets.load(textureUrl)) as Texture;
        textureWidth = texture.width;
        textureHeight = texture.height;
        sprite = new Sprite(texture);
        sprite.position.set(
            app.screen.width / 2 - textureWidth / 2,
            app.screen.height / 2 - textureHeight / 2,
        );
        app.stage.addChild(sprite);

        // Create BoneGraphic
        boneGraphic = new BoneGraphic(
            selectedBone.name,
            selectedBone.boneMetadata.height,
        );
        app.stage.addChild(boneGraphic);

        // Set bone position, rotation, and length
        const { anchor, rotation } =
            selectedBone.boneMetadata.textures[selectedTexture];
        boneGraphic.position.set(
            sprite.position.x + anchor.x * textureWidth,
            sprite.position.y + anchor.y * textureHeight,
        );
        boneGraphic.rotation = rotation;
        boneGraphic.length = selectedBone.boneMetadata.height;

        // Setup interactivity
        setupInteractivity();
    }

    function setupInteractivity() {
        if (!boneGraphic) return;

        boneGraphic.boneShape.eventMode = "static";
        boneGraphic.boneShape.cursor = "move";
        boneGraphic.boneShape
            .on("pointerdown", onDragStart)
            .on("pointerup", onDragEnd)
            .on("pointerupoutside", onDragEnd);

        boneGraphic.rotationHandle.eventMode = "static";
        boneGraphic.rotationHandle.cursor = "pointer";
        boneGraphic.rotationHandle
            .on("pointerdown", onRotateStart)
            .on("pointerup", onRotateEnd)
            .on("pointerupoutside", onRotateEnd);

        boneGraphic.scaleHandle.eventMode = "static";
        boneGraphic.scaleHandle.cursor = "pointer";
        boneGraphic.scaleHandle
            .on("pointerdown", onScaleStart)
            .on("pointerup", onScaleEnd)
            .on("pointerupoutside", onScaleEnd);

        app.stage.eventMode = "static";
        app.stage.on("pointermove", onGlobalPointerMove);
    }

    function onDragStart(event: any) {
        if (!boneGraphic) return;
        dragging = true;
        dragStartPosition = event.data.global.clone();
        originalPosition = boneGraphic.position.clone();
        boneGraphic.startDrag(event);
        event.stopPropagation();
    }

    function onDragEnd() {
        if (!boneGraphic) return;
        dragging = false;
        boneGraphic.endDrag();
        dispatchUpdate();
    }

    function onRotateStart(event: any) {
        if (!boneGraphic) return;
        rotating = true;
        rotationCenter = boneGraphic.position.clone();
        rotationStartAngle = Math.atan2(
            event.data.global.y - rotationCenter.y,
            event.data.global.x - rotationCenter.x,
        );
        boneGraphic.startRotate(event);
        event.stopPropagation();
    }

    function onRotateEnd() {
        if (!boneGraphic) return;
        rotating = false;
        boneGraphic.endRotate();
        dispatchUpdate();
    }

    function onScaleStart(event: any) {
        if (!boneGraphic) return;
        scaling = true;
        lengthStartPosition = event.data.global.clone();
        originalLength = boneGraphic.length;
        boneGraphic.startScale(event);
        event.stopPropagation();
    }

    function onScaleEnd() {
        if (!boneGraphic) return;
        scaling = false;
        boneGraphic.endScale();
        dispatchUpdate();
    }
    function onGlobalPointerMove(event: any) {
        if (!boneGraphic || !sprite) return;

        // Drag Position
        if (dragging) {
            const newPosition = event.data.global;
            const dx = newPosition.x - dragStartPosition.x;
            const dy = newPosition.y - dragStartPosition.y;
            const newX = Math.max(
                Math.min(
                    originalPosition.x + dx,
                    sprite.position.x + textureWidth,
                ),
                sprite.position.x,
            );
            const newY = Math.max(
                Math.min(
                    originalPosition.y + dy,
                    sprite.position.y + textureHeight,
                ),
                sprite.position.y,
            );
            boneGraphic.position.set(newX, newY);
        }
        // Draw Rotate (positive is CW in pixi.js v8)
        else if (rotating) {
            const currentAngle = Math.atan2(
                event.data.global.y - rotationCenter.y,
                event.data.global.x - rotationCenter.x,
            );
            let angleDiff = currentAngle - rotationStartAngle;

            // Normalize the rotation
            let newRotation = boneGraphic.rotation + angleDiff;
            // Not needed to normalize the rotation (seems pixi.js v8 does it automatically)
            // newRotation = ((newRotation + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
            boneGraphic.rotation = newRotation;
            rotationStartAngle = currentAngle;
        }
        // Drag scale
        else if (scaling) {
            const newPosition = event.data.global;
            const dy = newPosition.y - lengthStartPosition.y;
            const scaleFactor = 1 + dy / originalLength;
            const newLength = Math.max(10, originalLength * scaleFactor); // Minimum length of 10
            boneGraphic.length = newLength;
        }
    }

    function dispatchUpdate() {
        if (selectedBone && boneGraphic && sprite) {
            dispatch("boneUpdate", {
                bone: selectedBone,
                position: {
                    x: boneGraphic.position.x - sprite.position.x,
                    y: boneGraphic.position.y - sprite.position.y,
                },
                rotation: boneGraphic.rotation,
                length: boneGraphic.length,
                textureWidth,
                textureHeight,
            });
        }
    }
</script>

<div>
    <div bind:this={canvasElement} class="w-full h-full"></div>
    <p class="mt-2 text-sm font-mono">
        Bone Offset: X: {(boneGraphic?.position.x ?? 0) -
            (sprite?.position.x ?? 0)}, Y: {(boneGraphic?.position.y ?? 0) -
            (sprite?.position.y ?? 0)}
    </p>
    <p class="mt-2 text-sm font-mono">
        Rotation: {(((boneGraphic?.rotation ?? 0) * 180) / Math.PI).toFixed(2)}°
    </p>
    <p class="mt-2 text-sm font-mono">
        Length: {boneGraphic?.length.toFixed(2) ?? 0}
    </p>
</div>

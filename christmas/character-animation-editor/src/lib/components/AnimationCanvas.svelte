<script lang="ts">
    import {
        Application,
        Container,
        FederatedPointerEvent,
        Graphics,
        Point,
        RAD_TO_DEG,
    } from "pixi.js";
    import { onDestroy, onMount } from "svelte";
    import { timeIndex } from "../../../../app/src/lib/components/crossover/avatar/AnimationManager";
    import type { Avatar } from "../../../../app/src/lib/components/crossover/avatar/Avatar";
    import type { Bone } from "../../../../app/src/lib/components/crossover/avatar/Bone";
    import {
        addPoints,
        IKSystem,
        subtractPoints,
    } from "../../../../app/src/lib/components/crossover/avatar/IKSystem";
    import type {
        Animation,
        Pose,
    } from "../../../../app/src/lib/components/crossover/avatar/types";
    import { BoneGraphic } from "../BoneGraphic";
    import { avatar } from "../store";

    export let selectedAnimation: Animation | null = null;
    export let selectedPose: Pose | null = null;
    export let currentTime: number = 0;

    let canvasContainer: HTMLDivElement;
    let app: Application;
    let clientWidth: number;
    let clientHeight: number;
    let isInitialized = false;
    let boneGraphics: Record<string, BoneGraphic> = {};
    let ikTargetGraphics: Record<string, Graphics> = {};
    let boneContainer: Container;
    let showBones = true;

    let draggingBone: string | null = null;
    let rotatingBone: string | null = null;
    let scalingBone: string | null = null;
    let selectedBones: string[] = [];

    let startBonePosition = { x: 0, y: 0 };
    let startBoneRotation = 0;
    let startBoneScale = { x: 1, y: 1 };
    let startPosition = { x: 0, y: 0 };

    // let ikChains: Record<string, IKChain> = {};
    let activeIKChain: string | null = null;

    let boneLabels: { name: string; rotation: number } | null = null;

    $: resize(clientHeight, clientWidth);
    $: loadAvatar($avatar);
    $: loadAnimation(selectedAnimation);
    $: if (currentTime >= 0) updateAllBoneGraphics();
    $: if (currentTime >= 0) updateEffectorGraphics();

    // Load the avatar into the canvas
    function loadAvatar(avatar: Avatar | null) {
        if (!isInitialized || !app || !avatar) return;

        boneContainer = new Container();

        app.stage.removeChildren();
        app.stage.addChild(avatar);
        app.stage.addChild(boneContainer);

        // Center the avatar in the canvas
        centerAvatar(avatar);

        // Draw bones
        drawBoneGraphics(avatar);

        // Draw effectors
        updateEffectorGraphics();
    }

    // Center the avatar in the canvas
    function centerAvatar(avatar: Avatar) {
        if (!isInitialized || !app || !avatar || !boneContainer) return;
        avatar.position.set(
            Math.round(app.screen.width / 2),
            Math.round(app.screen.height * 0.8),
        );
        boneContainer.position = avatar.position;
    }

    // Resize function
    function resize(height: number, width: number) {
        if (!isInitialized || !app || !height || !width) return;
        app.renderer.resize(width, height);
        if ($avatar) centerAvatar($avatar);
    }

    async function loadAnimation(animation: Animation | null) {
        if (!isInitialized || !app || !$avatar || !animation || !selectedPose)
            return;

        // Set bone transforms using the selected pose
        await $avatar.pose(selectedPose);

        centerAvatar($avatar);

        updateAllBoneGraphics();

        updateEffectorGraphics();
    }

    function drawBoneGraphics(avatar: Avatar) {
        // Clear existing bone graphics
        boneContainer.removeChildren();
        boneGraphics = {};

        // Helper function to create bone graphic and its children recursively
        function createBoneGraphicHierarchy(
            bone: Bone,
            parentGraphic: Container | null = null,
        ) {
            // Set bone transform based on selected pose
            if (selectedPose) {
                const poseBone = selectedPose.find(
                    (poseBone) => poseBone.bone === bone.name,
                );
                if (poseBone) {
                    bone.position.set(poseBone.position.x, poseBone.position.y);
                    bone.rotation = poseBone.rotation;
                }
            }

            // Create bone graphic
            const boneGraphic = new BoneGraphic(
                bone.name,
                bone.boneMetadata.height,
            );
            boneGraphics[bone.name] = boneGraphic;
            boneGraphic.setVisible(showBones);

            // Position should follow the pose
            boneGraphic.position.copyFrom(bone.position);
            boneGraphic.rotation = bone.rotation;
            boneGraphic.eventMode = "static";
            boneGraphic.cursor = "pointer";
            boneGraphic.on("pointerdown", (event) =>
                onBonePointerDown(event, bone.name),
            );

            // Add to parent graphic or boneContainer
            if (parentGraphic) {
                parentGraphic.addChild(boneGraphic);
            } else {
                boneContainer.addChild(boneGraphic);
            }

            // Recursively create graphics for child bones
            const childBones = avatar
                .getAllBones()
                .filter((childBone) => childBone.parent === bone);
            childBones.forEach((childBone) =>
                createBoneGraphicHierarchy(childBone, boneGraphic),
            );
        }

        // Find root bones (parent is avatar) and start the hierarchy
        const rootBones = avatar
            .getAllBones()
            .filter((bone) => bone.parent === $avatar);
        rootBones.forEach((rootBone) => {
            createBoneGraphicHierarchy(rootBone);
        });
    }

    function onEffectorPointerDown(
        event: FederatedPointerEvent,
        chainName: string,
    ) {
        if (!$avatar) return;

        activeIKChain = chainName;
        const chain = $avatar.animationManager.ikChains[chainName];
        const targetName = `${chainName}_effector`;
        const ikTargetGraphic = ikTargetGraphics[targetName];

        if (ikTargetGraphic) {
            const parent = ikTargetGraphic.parent as Container;
            const startPosition = parent.toLocal(event.global).clone();
            const startTargetPosition = ikTargetGraphic.position.clone();

            const onDragMove = (moveEvent: FederatedPointerEvent) => {
                const localPosition = parent.toLocal(moveEvent.global);
                const newPosition = addPoints(
                    startTargetPosition,
                    subtractPoints(localPosition, startPosition), // dxy
                );
                ikTargetGraphic.position.copyFrom(newPosition);

                // Solve IK
                const bones = chain.bones.map((bone: string) =>
                    $avatar.getBone(bone),
                ) as Bone[];
                const effectorBone = $avatar.getBone(chain.effector.boneName);
                if (!effectorBone) return;
                IKSystem.solve({
                    bones,
                    effectorBone,
                    targetPosition: effectorBone.toLocal(
                        ikTargetGraphic.getGlobalPosition(),
                    ), // relative to effector bone
                    effectorOffset: new Point(
                        chain.effector.offset.x,
                        chain.effector.offset.y,
                    ),
                    constraints: chain.constraints,
                });

                // Update bone graphics
                updateAllBoneGraphics();

                // Update all pose bones if tIdx == 0
                updateAllPoseBones();
            };

            const onDragEnd = () => {
                app.stage.off("pointermove", onDragMove);
                app.stage.off("pointerup", onDragEnd);
                app.stage.off("pointerupoutside", onDragEnd);
                activeIKChain = null;
            };

            app.stage.on("pointermove", onDragMove);
            app.stage.on("pointerup", onDragEnd);
            app.stage.on("pointerupoutside", onDragEnd);
        }

        event.stopPropagation();
    }

    function handleBoneSelection(event: Event) {
        const select = event.target as HTMLSelectElement;
        selectedBones = Array.from(
            select.selectedOptions,
            (option) => option.value,
        );
        updateSelectedBones(selectedBones);
    }

    function updateSelectedBones(selectedBones: string[]) {
        if (!$avatar || !boneContainer) return;

        // Update all bones
        $avatar.getAllBones().forEach((bone) => {
            const boneGraphic = boneGraphics[bone.name];
            if (boneGraphic) {
                boneGraphic.setSelected(selectedBones.includes(bone.name));
            }
        });
        boneContainer.sortChildren();
    }

    function onBonePointerDown(event: FederatedPointerEvent, boneName: string) {
        if (!$avatar || !selectedBones.includes(boneName)) return;

        const bone = $avatar.getBone(boneName);
        if (!bone) return;

        const boneGraphic = boneGraphics[boneName];
        const localPosition = boneGraphic.toLocal(event.global);

        if (boneGraphic.rotationHandle.containsPoint(localPosition)) {
            startRotate(event, boneName);
        } else if (boneGraphic.scaleHandle.containsPoint(localPosition)) {
            startScale(event, boneName);
        } else {
            startDrag(event, boneName);
        }
    }

    function startDrag(event: FederatedPointerEvent, boneName: string) {
        draggingBone = boneName;
        const bone = $avatar?.getBone(boneName);
        if (bone) {
            const parent = bone.parent as Container;
            startPosition = parent.toLocal(event.global).clone();
            startBonePosition = bone.position.clone();
            boneGraphics[boneName].startDrag(event);
            // Hide other bones
            hideAllBones();
        }
        app.stage.on("pointermove", onDragMove);
    }

    function startRotate(event: FederatedPointerEvent, boneName: string) {
        rotatingBone = boneName;
        const bone = $avatar?.getBone(boneName);
        if (bone) {
            const parent = bone.parent as Container;
            const localPosition = parent.toLocal(event.global);
            startBoneRotation =
                Math.atan2(localPosition.y - bone.y, localPosition.x - bone.x) -
                bone.rotation;
            boneGraphics[boneName].startRotate(event);
            // Hide other bones
            hideAllBones();
        }
        app.stage.on("pointermove", onDragMove);
    }

    function startScale(event: FederatedPointerEvent, boneName: string) {
        scalingBone = boneName;
        const bone = $avatar?.getBone(boneName);
        if (bone) {
            const parent = bone.parent as Container;
            startBoneScale = bone.scale.clone();
            startPosition = parent.toLocal(event.global).clone();
            boneGraphics[boneName].startScale(event);
            // Hide other bones
            hideAllBones();
        }
        app.stage.on("pointermove", onDragMove);
    }

    function onDragEnd() {
        if (draggingBone && $avatar) {
            boneGraphics[draggingBone].endDrag();
        }
        if (rotatingBone && $avatar) {
            boneGraphics[rotatingBone].endRotate();
        }
        if (scalingBone && $avatar) {
            boneGraphics[scalingBone].endScale();
        }
        // Show all bones
        showAllBones();
        draggingBone = null;
        rotatingBone = null;
        scalingBone = null;
        app.stage.off("pointermove", onDragMove);
    }

    function toggleBonesVisibility() {
        showBones = !showBones;
        Object.values(boneGraphics).forEach((graphic) =>
            graphic.setVisible(showBones),
        );
    }

    function showAllBones() {
        Object.values(boneGraphics).forEach((graphic) =>
            graphic.setVisible(true),
        );
    }

    function hideAllBones() {
        Object.values(boneGraphics).forEach((graphic) =>
            graphic.setVisible(false),
        );
    }

    function onDragMove(event: FederatedPointerEvent) {
        // Drag Position
        if (draggingBone && $avatar) {
            const bone = $avatar.getBone(draggingBone);
            if (bone) {
                // Convert global positions to the parent's coordinate system
                const parent = bone.parent as Container;
                const localPosition = parent.toLocal(event.global);

                // Calculate delta in bone's local coordinate system
                const dx = localPosition.x - startPosition.x;
                const dy = localPosition.y - startPosition.y;

                // Update bone position
                bone.position.x = startBonePosition.x + dx;
                bone.position.y = startBonePosition.y + dy;

                // Update bone graphic
                updateBoneGraphic(draggingBone, bone);

                // Update bone pose
                updatePoseBone(bone.name, bone);
            }
        }
        // Drag Scale
        else if (scalingBone && $avatar) {
            const bone = $avatar.getBone(scalingBone);
            if (bone) {
                // Convert global positions to the parent's coordinate system
                const parent = bone.parent as Container;
                const localPosition = parent.toLocal(event.global);
                const dx = localPosition.x - startPosition.x;
                const dy = localPosition.y - startPosition.y;

                // ONLY ALLOW SCALING ALONG BONE FOR NOW
                bone.scale.x = startBoneScale.x + dx / bone.boneMetadata.height;

                // Update bone graphic
                updateBoneGraphic(scalingBone, bone);

                // Update bone pose
                updatePoseBone(bone.name, bone);
            }
        }
        // Drag Rotate
        else if (rotatingBone && $avatar) {
            const bone = $avatar.getBone(rotatingBone);
            if (bone) {
                // Convert global positions to the parent's coordinate system
                const parent = bone.parent as Container;
                const localPosition = parent.toLocal(event.global);
                const angle = Math.atan2(
                    localPosition.y - bone.y,
                    localPosition.x - bone.x,
                );

                let newRotation = angle - startBoneRotation;
                newRotation =
                    ((newRotation + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
                bone.rotation = newRotation;

                // Update Label
                boneLabels = {
                    name: bone.name,
                    rotation: bone.rotation,
                };

                // Update bone graphic
                updateBoneGraphic(rotatingBone, bone);

                // Update bone pose
                updatePoseBone(bone.name, bone);
            }
        }
    }

    function updatePoseBone(boneName: string, bone: Bone) {
        const tIdx = timeIndex(currentTime);

        // Only update PoseBone if tIdx = 0
        if (!selectedPose || tIdx !== 0 || !selectedPose) return;
        const poseBone = selectedPose.find(
            (poseBone) => poseBone.bone === boneName,
        );
        if (poseBone) {
            poseBone.position.x = bone.position.x;
            poseBone.position.y = bone.position.y;
            poseBone.rotation = bone.rotation;
            poseBone.scale.x = bone.scale.x;
            poseBone.scale.y = bone.scale.y;
        }
    }

    function updateBoneGraphic(boneName: string, bone: Bone) {
        const boneGraphic = boneGraphics[boneName];
        if (boneGraphic) {
            boneGraphic.position.copyFrom(bone.position);
            boneGraphic.rotation = bone.rotation;
            boneGraphic.length = bone.boneMetadata.height;
            boneGraphic.scale.copyFrom(bone.scale);
        }
    }

    function updateAllBoneGraphics() {
        if (!$avatar) return;
        $avatar.getAllBones().forEach((bone) => {
            updateBoneGraphic(bone.name, bone);
        });
    }

    function updateAllPoseBones() {
        if (!$avatar) return;
        $avatar.getAllBones().forEach((bone) => {
            updatePoseBone(bone.name, bone);
        });
    }

    function updateEffectorGraphics() {
        if (!$avatar || !boneContainer || !isInitialized) return;

        for (const [chainName, { effector }] of Object.entries(
            $avatar.animationManager.ikChains,
        )) {
            const effectorBone = $avatar.getBone(effector.boneName);
            if (!effectorBone) continue;
            const targetPosition = new Point(
                effector.offset.x + effectorBone.boneMetadata.height, // draw effector at the end of the bone
                effector.offset.y,
            );

            const targetName = `${chainName}_effector`;
            let ikTargetGraphic = ikTargetGraphics[targetName];

            // Create effector if it doesn't exist
            if (ikTargetGraphic == null) {
                ikTargetGraphic = new Graphics();
                ikTargetGraphic
                    .circle(0, 0, 10)
                    .fill({ color: 0x00ffff })
                    .stroke({ color: 0x0000ff, width: 2 });
                ikTargetGraphic.tint = 0x00ffff; // Cyan
                ikTargetGraphic.alpha = 0.5;
                ikTargetGraphic.eventMode = "static";
                ikTargetGraphic.cursor = "move";
                ikTargetGraphic.on("pointerdown", (event) =>
                    onEffectorPointerDown(event, chainName),
                );
                boneContainer.addChild(ikTargetGraphic);
                ikTargetGraphics[targetName] = ikTargetGraphic;
            }

            // Update effector position
            const globalPosition = effectorBone.toGlobal(targetPosition);
            const localPosition = boneContainer.toLocal(globalPosition);
            ikTargetGraphic.position.copyFrom(localPosition);
        }
    }

    // Initialize the canvas
    async function init() {
        const width = clientWidth || 800;
        const height = clientHeight || 800;

        app = new Application();
        app.stage.sortableChildren = true;
        await app.init({
            width,
            height,
            backgroundColor: 0xaaaaaa,
            antialias: true,
        });

        canvasContainer.appendChild(app.canvas);

        // Add event listeners for dragging
        app.stage.eventMode = "static";
        app.stage.hitArea = app.screen;
        app.stage.on("pointerup", onDragEnd);
        app.stage.on("pointerupoutside", onDragEnd);

        isInitialized = true;

        loadAvatar($avatar);
    }

    onMount(() => {
        init();
    });

    onDestroy(() => {
        if (app) {
            app.stage.removeChildren();
            app.destroy(true, { children: true, texture: true });
        }
    });
</script>

<div
    class="w-full h-full relative"
    bind:this={canvasContainer}
    bind:clientHeight
    bind:clientWidth
>
    <!-- Bone selection -->
    <div class="absolute bottom-0 left-0 p-1">
        <label class="block mb-2" for="bone-select">Select Bones to Move</label>
        <select
            id="bone-select"
            multiple
            class="w-full p-2 border rounded h-[210px]"
            on:change={handleBoneSelection}
        >
            {#if $avatar}
                {#each $avatar.getAllBones() as bone}
                    <option value={bone.name}>{bone.name}</option>
                {/each}
            {/if}
        </select>
    </div>
    <!-- Toggle Bones Visibility Button -->
    <button
        class="absolute top-4 left-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        on:click={toggleBonesVisibility}
    >
        {showBones ? "Hide" : "Show"} Bones
    </button>
    <!-- Rotation Labels -->
    {#if boneLabels != null && boneLabels.rotation != null}
        <div class="absolute bottom-0 right-0">
            <p>{boneLabels.name}</p>
            <p class="mt-2 text-sm font-mono">
                Rotation: {boneLabels.rotation.toFixed(2)} ({(
                    boneLabels.rotation * RAD_TO_DEG
                ).toFixed(2)}° )
            </p>
        </div>
    {/if}
</div>

<style>
    :global(canvas) {
        display: block;
    }
</style>

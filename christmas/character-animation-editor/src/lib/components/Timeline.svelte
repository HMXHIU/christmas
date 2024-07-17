<!-- src/lib/components/Timeline.svelte -->
<script lang="ts">
  import { groupBy } from "lodash";
  import { timeIndex } from "../avatar/AnimationManager";
  import { avatar } from "../store";
  import { type Animation, type KeyFrame, type Pose } from "../avatar/types";

  export let animation: Animation | null = null;
  export let pose: Pose | null = null;
  export let currentTime: number = 0;

  async function updateTime(newTime: number) {
    if (!animation || !pose || !$avatar) return;
    currentTime = timeIndex(Math.max(0, Math.min(newTime, animation.duration)));

    // Update the bones using the pose at time 0
    if (currentTime === 0) {
      await $avatar.pose(pose);
    }
    // Update the avatar bone transforms to reflect the animation at this time
    else {
      await $avatar.animationManager.poseAtTime(
        pose,
        animation,
        currentTime,
        $avatar.bones
      );
    }
  }

  function addKeyframe() {
    if (!animation || !$avatar || !pose) return;
    console.log("Adding Keyframe at", currentTime);

    let hasChanges = false;

    // Iterate through all bones in the avatar
    for (const [boneName, bone] of Object.entries($avatar.bones)) {
      let boneAnimation = animation.bones.find(
        (ba) => ba.boneName === boneName
      );

      // Find the initial pose for this bone
      const initialBonePose = pose.find((bp) => bp.bone === boneName);
      if (!initialBonePose) {
        console.error(`Initial pose not found for bone: ${boneName}`);
        continue;
      }

      // Convert bone pose to initial keyframe
      const initialKeyframe: KeyFrame = {
        time: 0,
        position: initialBonePose.position,
        rotation: initialBonePose.rotation,
        scale: initialBonePose.scale,
      };

      // Find the last keyframe before the current time
      const lastKeyframe = boneAnimation?.keyframes
        .filter((kf) => kf.time <= currentTime)
        .sort((a, b) => b.time - a.time)[0];

      // Create a new keyframe
      const newKeyframe: KeyFrame = {
        time: currentTime,
      };

      // Check if there are any changes from the initial pose or the last keyframe
      let keyframeHasChanges = false;
      const referenceKeyframe = lastKeyframe || initialKeyframe;
      if (
        referenceKeyframe?.position?.x !== bone.position.x ||
        referenceKeyframe?.position?.y !== bone.position.y
      ) {
        newKeyframe.position = { x: bone.position.x, y: bone.position.y };
        keyframeHasChanges = true;
      }
      if (referenceKeyframe?.rotation !== bone.rotation) {
        newKeyframe.rotation = bone.rotation;
        keyframeHasChanges = true;
      }
      if (
        referenceKeyframe?.scale?.x !== bone.scale.x ||
        referenceKeyframe?.scale?.y !== bone.scale.y
      ) {
        newKeyframe.scale = { x: bone.scale.x, y: bone.scale.y };
        keyframeHasChanges = true;
      }

      // Only add the keyframe if there are changes
      if (keyframeHasChanges) {
        if (!boneAnimation) {
          boneAnimation = { boneName, keyframes: [] };
          animation.bones.push(boneAnimation);
        }
        boneAnimation.keyframes.push(newKeyframe);
        hasChanges = true;
      }
    }

    // Only update the animation if there were any changes
    if (hasChanges) {
      // Sort keyframes by time for each bone animation
      for (const boneAnimation of animation.bones) {
        boneAnimation.keyframes.sort((a, b) => a.time - b.time);
      }

      // Update the animation in the store
      animation = animation;
    } else {
      console.log("No changes detected. Keyframe not added.");
    }
  }

  function removeKeyframe() {
    if (!animation || !$avatar) return;
    console.log("Remove Keyframe at", currentTime);
    const tIdx = timeIndex(currentTime);
    for (let boneAnimation of animation.bones) {
      for (let keyframe of boneAnimation.keyframes) {
        if (timeIndex(keyframe.time) === tIdx) {
          // Remove the keyframe
          boneAnimation.keyframes = boneAnimation.keyframes.filter(
            (kf) => kf.time !== tIdx
          );
        }
      }
    }
    animation = animation;
  }

  /**
   * Insert keyframes every 100ms if there isnt any keyframe at that time
   */
  function keyframesByTime(
    keyframes: KeyFrame[],
    duration: number
  ): [number, KeyFrame | null][] {
    const byTime = Object.fromEntries(
      Object.entries(groupBy(keyframes, "time")).map(([time, keyframes]) => {
        return [timeIndex(time), keyframes[0]];
      })
    );
    const keyframesWithInterpolated: [number, KeyFrame | null][] = [];
    for (let t = 0; t <= duration + 0.1; t += 0.1) {
      const tIdx = timeIndex(t);
      if (byTime[tIdx] == null) {
        keyframesWithInterpolated.push([tIdx, null]);
      } else {
        keyframesWithInterpolated.push([tIdx, byTime[tIdx]]);
      }
    }

    return keyframesWithInterpolated;
  }
</script>

{#if animation}
  <div class="flex flex-col timeline h-full p-4">
    <!-- Timeline slider -->
    <div class="flex items-center space-x-4">
      <h2 class="text-sm font-bold my-auto">Timeline</h2>
      <input
        type="range"
        min="0"
        max={animation.duration}
        step="0.01"
        bind:value={currentTime}
        on:input={() => updateTime(currentTime)}
        class="flex-grow"
      />
      <span>{currentTime}s / {animation.duration}s</span>
      <!-- Add Keyframe -->
      <button
        on:click={addKeyframe}
        class="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 text-sm"
      >
        + Keyframe
      </button>
      <!-- Delete Keyframe -->
      <button
        on:click={removeKeyframe}
        class="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 text-sm"
      >
        - Keyframe
      </button>
    </div>

    <!-- Bone Keyframes -->
    <div class="mt-4 flex flex-col">
      {#each animation.bones as { boneName, keyframes }}
        <div class="flex items-center space-x-4">
          <span class="w-12 text-xs text-ellipsis">{boneName}</span>
          {#each keyframesByTime(keyframes, animation.duration) as [time, kf]}
            <div
              class={`w-10 bg-blue-200 rounded p-1 ${time === currentTime ? "bg-yellow-200" : ""}`}
              style="left: {(time / animation.duration) * 100}%;"
            >
              <div class="flex flex-col text-xs font-mono text-center">
                <p>
                  {#if kf?.rotation != null}
                    <span>R</span>
                  {/if}
                  {#if kf?.position != null}
                    <span>P</span>
                  {/if}
                  {#if kf?.scale != null}
                    <span>S</span>
                  {/if}
                </p>
              </div>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </div>
{/if}

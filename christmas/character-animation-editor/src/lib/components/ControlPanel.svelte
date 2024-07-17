<!-- src/lib/components/ControlPanel.svelte -->
<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { Animation, Pose } from "../avatar/types";
  import { avatar } from "../store";
  import RiggingTool from "./RiggingTool.svelte";

  const dispatch = createEventDispatcher();

  export let selectedAnimation: Animation | null = null;
  export let selectedPose: Pose | null = null;

  let showRiggingTool: boolean = false;
  let loopAnimation: boolean = false;

  function handleAvatarFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        if (!$avatar) return;
        const avatarMetadata = JSON.parse(content);
        await $avatar.loadFromMetadata(avatarMetadata);
        avatar.set($avatar);
      };
      reader.readAsText(file);
    }
  }

  function handleAnimationFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (!$avatar) return;
        $avatar.animationManager.load(JSON.parse(content));
        avatar.set($avatar);

        // Load default animation and pose
        if ($avatar?.animationManager?.animations != null) {
          selectedAnimation = Object.values(
            $avatar.animationManager.animations
          )[0];
          const pose = selectedAnimation.pose;
          if ($avatar.animationManager.poses[pose]) {
            selectedPose = $avatar.animationManager.poses[pose];
          }
        }
      };
      reader.readAsText(file);
    }
  }

  function playAnimation() {
    if (selectedAnimation && $avatar) {
      $avatar.playAnimation(
        selectedAnimation.animation,
        loopAnimation,
        () => {}
      );
    }
  }

  function stopAnimation() {
    if ($avatar) {
      $avatar.stopAnimation();
    }
  }
  function toggleRiggingTool() {
    showRiggingTool = !showRiggingTool;
  }

  function handleRiggingToolClose() {
    showRiggingTool = false;
  }

  function exportAvatar() {
    if (!$avatar) {
      console.error("No avatar to export");
      return;
    }
    const blob = new Blob([JSON.stringify($avatar.deserialize(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "avatar_metadata.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportAnimation() {
    if (!$avatar) return;
    const animationMetadata = $avatar.animationManager.deserialize();
    const blob = new Blob([JSON.stringify(animationMetadata, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `animation_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="w-fulll h-full bg-gray-100 p-4 overflow-y-auto">
  <h2 class="text-xl font-bold mb-4">Control Panel</h2>

  <!-- Load Avatar -->
  <div class="mb-4">
    <label class="block mb-2" for="avatarFile">Load Avatar Metadata</label>
    <input
      type="file"
      id="avatarFile"
      accept=".json"
      on:change={handleAvatarFileSelect}
      class="w-full"
    />
  </div>

  <!-- Load Animations -->
  <div class="mb-4">
    <label class="block mb-2" for="animationFile">Load Animation Metadata</label
    >
    <input
      type="file"
      id="animationFile"
      accept=".json"
      on:change={handleAnimationFileSelect}
      class="w-full"
    />
  </div>

  <!-- Select Animation -->
  <div class="mb-4">
    <label class="block mb-2" for="animation-select">Select Animation</label>
    <select
      id="animation-select"
      bind:value={selectedAnimation}
      class="w-full p-2 border rounded"
    >
      <option value={null}>Select an animation</option>
      {#if $avatar?.animationManager?.animations != null}
        {#each Object.entries($avatar.animationManager.animations) as [animationName, animation]}
          <option value={animation}>{animationName}</option>
        {/each}
      {/if}
    </select>
  </div>

  <!-- Select Pose -->
  <div class="mb-4">
    <label class="block mb-2" for="pose-select">Select Pose</label>
    <select
      id="pose-select"
      bind:value={selectedPose}
      class="w-full p-2 border rounded"
    >
      <option value={null}>Select a pose</option>
      {#if $avatar?.animationManager?.poses != null}
        {#each Object.entries($avatar.animationManager.poses) as [poseName, pose]}
          <option value={pose}>{poseName}</option>
        {/each}
      {/if}
    </select>
  </div>

  <!-- Loop Animation Checkbox -->
  <div class="mb-4">
    <label class="flex items-center">
      <input
        type="checkbox"
        bind:checked={loopAnimation}
        class="form-checkbox h-5 w-5 text-blue-600"
      />
      <span class="ml-2 text-gray-700">Loop Animation</span>
    </label>
  </div>

  <!-- Tools -->
  <div class="flex space-x-2 mb-4">
    <!-- Play Animation -->
    <button
      on:click={playAnimation}
      class="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
      disabled={!selectedAnimation}
    >
      Play
    </button>
    <button
      on:click={stopAnimation}
      class="bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600"
    >
      Stop
    </button>
    <!-- Rig Bone Textures -->
    <button
      on:click={toggleRiggingTool}
      class="bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600"
    >
      Rig Bone Textures
    </button>
  </div>

  <!-- Export -->
  <div class="mb-4 flex flex-row space-x-2">
    <button
      on:click={exportAvatar}
      class="bg-purple-500 text-white py-2 px-4 rounded hover:bg-purple-600 w-full"
      disabled={!$avatar}
    >
      Export Avatar
    </button>
    <button
      class="bg-cyan-500 text-white py-2 px-4 rounded hover:bg-purple-600 w-full"
      on:click={exportAnimation}
      disabled={!$avatar}
    >
      Export Animation
    </button>
  </div>

  <RiggingTool show={showRiggingTool} on:close={handleRiggingToolClose} />
</div>

<!-- src/lib/components/RiggingTool.svelte -->
<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { Bone } from "../avatar/Bone";
  import { avatar } from "../store";
  import BonePositioningCanvas from "./BonePositioningCanvas.svelte";

  export let show: boolean = false;

  const dispatch = createEventDispatcher();

  let selectedBone: Bone | null = null;
  let selectedTexture: string | null = null;
  let selectedTexturePreview: string | null = null;

  function closeModal() {
    dispatch("close");
  }

  function selectBone(bone: Bone) {
    if (!$avatar) {
      return;
    }
    selectedBone = bone;
    selectedTexture = bone.textureKey;
  }

  function selectTexture(textureKey: string) {
    selectedTexture = selectedTexturePreview = textureKey;
    attachTextureToBone(selectedTexture);
  }

  async function attachTextureToBone(textureKey: string) {
    if (!selectedBone) {
      return;
    }
    await selectedBone.setTexture(textureKey);
    dispatch("boneUpdated", { bone: selectedBone.name });
  }

  /**
   * Handle bone update event from BonePositioningCanvas
   * These values are all in clip space (on the texture)
   * Update the texture transform of the bone only
   * The bone's position is set in the avatar's coordinate space
   */
  function handleBoneUpdate(
    event: CustomEvent<{
      bone: Bone;
      position: { x: number; y: number };
      rotation: number;
      length: number;
      textureWidth: number;
      textureHeight: number;
    }>
  ) {
    const { bone, position, textureHeight, textureWidth, rotation, length } =
      event.detail;

    bone.boneMetadata.height = length;
    bone.setTextureTransform({
      anchor: {
        x: position.x / textureWidth,
        y: position.y / textureHeight,
      },
      rotation,
    });

    dispatch("boneUpdated", { bone: bone.name });
  }
</script>

{#if show && $avatar}
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
  >
    <div
      class="bg-white w-full h-full max-w-6xl max-h-[90vh] rounded-lg shadow-lg flex flex-col"
    >
      <div
        class="p-4 border-b border-gray-200 flex justify-between items-center"
      >
        <h2 class="text-2xl font-bold">Rigging Tool</h2>
        <button on:click={closeModal} class="text-gray-500 hover:text-gray-700">
          <svg
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            ></path>
          </svg>
        </button>
      </div>
      <div class="flex-1 flex overflow-hidden">
        <div class="w-1/3 p-4 border-r border-gray-200 overflow-y-auto">
          <!-- Bones -->
          <h3 class="text-lg font-bold mb-2">Bones</h3>
          <ul
            class="mb-4 p-2 space-y-1 border rounded max-h-80 overflow-y-auto"
          >
            {#each Object.entries($avatar.bones) as [boneName, bone]}
              <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
              <li
                class="p-0 cursor-pointer hover:bg-gray-100"
                class:bg-blue-100={selectedBone === bone}
                on:click={() => selectBone(bone)}
              >
                {bone.name}
              </li>
            {/each}
          </ul>
          <!-- Textures -->
          <h3 class="text-lg font-bold mb-2">Textures</h3>
          <ul
            class="mb-4 p-2 space-y-1 border rounded max-h-80 overflow-y-auto"
          >
            {#if selectedBone != null}
              {#each Object.keys(selectedBone.boneMetadata.textures) as texture}
                <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
                <li
                  class="cursor-pointer hover:bg-gray-100"
                  class:bg-blue-100={selectedTexture === texture}
                  on:click={() => (selectedTexturePreview = texture)}
                >
                  <div class="flex flex-row justify-between">
                    <p>{texture}</p>
                    {#if selectedTexture !== texture && selectedBone}
                      <button
                        class="border p-1 text-xs hover:bg-gray-200 rounded"
                        on:click={() => selectTexture(texture)}
                        >Set Bone
                      </button>
                    {/if}
                  </div>
                </li>
              {/each}
            {/if}
          </ul>
          <h3 class="text-lg font-bold mb-2">Texture Preview</h3>
          {#if selectedTexturePreview && selectedBone}
            <img
              src={selectedBone.textures[selectedTexturePreview]}
              alt={selectedTexturePreview}
              class="w-48 h-48 object-cover"
            />
          {/if}
        </div>
        <div class="w-2/3 p-4">
          <BonePositioningCanvas
            {selectedBone}
            on:boneUpdate={handleBoneUpdate}
          />
        </div>
      </div>
    </div>
  </div>
{/if}

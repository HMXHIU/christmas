<script lang="ts">
    export let message = "";
    export let file: File | null = null;
    export let image: string | null = null;

    let fileInput: HTMLInputElement;

    const onChangeImage = (event: Event) => {
        const inputElement = event.target as HTMLInputElement;
        const selectedFile = inputElement.files?.[0];

        if (selectedFile) {
            // Set file
            file = selectedFile;

            // Set image preview
            const reader = new FileReader();
            reader.onloadend = () => {
                image = reader.result as string;
            };
            reader.readAsDataURL(selectedFile);
        }
    };

    const onButtonClick = () => {
        // Trigger the hidden file input
        fileInput?.click();
    };
</script>

<div>
    <!-- Note: type="button" to prevent the button from triggering form submit in parent, also add preventDefault to be safe -->
    <button class="input-box" on:click={onButtonClick} type="button">
        {message}
        {#if image}
            <img src={image} alt="Preview" />
        {/if}
        <input
            bind:this={fileInput}
            class="input"
            type="file"
            accept="image/*"
            on:change|preventDefault={onChangeImage}
        />
    </button>
</div>

<style>
    img {
        max-width: 100%;
        max-height: 100%;
        width: auto;
        height: auto;
        display: block;
        position: absolute;
        border-radius: 10px;
        pointer-events: none; /* Allow clicks to pass through the image */
        object-fit: contain; /* Adjust this property as needed (e.g., contain) */
    }

    /* Hide the default file input */
    input[type="file"] {
        display: none;
    }

    /* Add the button styles */
    .input-box {
        position: relative; /* Make sure the image is positioned relative to the button */
        margin: 4px;
        width: 150px;
        height: 150px;
        border: 2px dashed #3498db;
        border-radius: 10px;
        background-color: transparent;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        overflow: hidden; /* Hide any content that overflows the button */
        transition: background-color 0.3s ease;
    }

    .input-box:hover {
        background-color: rgba(52, 152, 219, 0.2);
    }
</style>

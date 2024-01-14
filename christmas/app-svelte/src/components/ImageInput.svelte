<script lang="ts">
	export let label = '';
	export let message = '';

	let file = null;
	let image: string | null = null;
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
		console.log('BTN CLICK');
	};
</script>

<label class="label" for="image">
	<span>{label}</span>
	<button class="input-box" on:click={onButtonClick}>
		{message}
		{#if image}
			<img src={image} alt="Preview" />
		{/if}
		<input
			bind:this={fileInput}
			class="input"
			type="file"
			id="image"
			name="image"
			accept="image/*"
			on:change={onChangeImage}
		/>
	</button>
</label>

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
	input[type='file'] {
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

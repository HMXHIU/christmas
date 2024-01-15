<script lang="ts">
	import type { SvelteComponent } from 'svelte';
	import { onMount } from 'svelte';
	import { getModalStore } from '@skeletonlabs/skeleton';
	import { STORE_NAME_SIZE, STRING_PREFIX_SIZE } from '../../../lib/anchor-client/defs';
	import ImageInput from './ImageInput.svelte';
	import { userDeviceClient } from '../store';
	import ngeohash from 'ngeohash';
	import LocationSearch from './LocationSearch.svelte';
	import { COUNTRY_DETAILS } from '../../../lib/user-device-client/defs';

	import * as yup from 'yup';

	const modalStore = getModalStore();

	export let parent: SvelteComponent;

	let values: {
		name?: string;
		description?: string;
		address?: string;
		region?: string;
		latitude?: number;
		longitude?: number;
		geohash?: string | null;
		logo?: File | null;
	} = {};

	let errors: {
		name?: string;
		description?: string;
		address?: string;
		region?: string;
		longitude?: string;
		latitude?: string;
		geohash?: string;
	} = {};

	// update geohash if user manually changes latitude or longitude
	if (values.latitude != null && values.longitude != null) {
		values.geohash = ngeohash.encode(values.latitude, values.longitude, 6);
	}

	const schema = yup.object().shape({
		name: yup.string().required('Your store needs a name.'),
		description: yup.string().required('Your store needs a description.'),
		address: yup.string().required('Your store needs an address.'),
		region: yup.string().required('Your store needs to belong to a region.'),
		latitude: yup.number().required('Your store needs coordinates.'),
		longitude: yup.number().required('Your store needs coordinates.')
	});

	onMount(async () => {
		// only use default location on initial load
		values = {
			region: $userDeviceClient?.location.country?.code,
			latitude: $userDeviceClient?.location.geolocationCoordinates?.latitude,
			longitude: $userDeviceClient?.location.geolocationCoordinates?.longitude,
			geohash: $userDeviceClient?.location?.geohash
		};
	});

	async function onCreateStore() {
		console.log('ON CREATE STORE');
		try {
			await schema.validate(values, { abortEarly: false }); // `abortEarly: false` to get all the errors
			errors = {};

			// Success
			if ($modalStore[0].response) $modalStore[0].response(values);
			modalStore.close();
		} catch (err) {
			errors = extractErrors(err);
		}
	}

	function extractErrors(err: any) {
		return err.inner.reduce((acc: any, err: any) => {
			return { ...acc, [err.path]: err.message };
		}, {});
	}

	function onManualLatLng(ev: Event) {
		if (values.latitude != null && values.longitude != null) {
			values.geohash = ngeohash.encode(values.latitude, values.longitude, 6);
			values = values;
		}
	}
</script>

{#if $modalStore[0]}
	<div class="card space-y-4 shadow-xl w-11/12">
		<form
			class="p-4 space-y-4 rounded-container-token"
			id="createStoreForm"
			on:submit|preventDefault={onCreateStore}
		>
			<!-- Store name -->
			<label class="label">
				<span>Store Name</span>
				<input
					class="input"
					type="text"
					maxlength={STORE_NAME_SIZE - STRING_PREFIX_SIZE}
					bind:value={values.name}
					placeholder="Your community store"
				/>
				{#if errors.name}
					<p class="text-xs text-error-400">{errors.name}</p>
				{/if}
			</label>

			<!-- Store description -->
			<label class="label">
				<span>Store Description</span>
				<textarea
					class="textarea"
					rows="4"
					placeholder="What is your community store about?"
					maxlength={400}
					bind:value={values.description}
				/>
				{#if errors.description}
					<p class="text-xs text-error-400">{errors.description}</p>
				{/if}
			</label>

			<!-- Store logo -->
			<ImageInput label="Store Logo" message="150x150" bind:file={values.logo}></ImageInput>

			<hr />

			<!-- Address -->
			<LocationSearch
				bind:region={values.region}
				bind:address={values.address}
				bind:latitude={values.latitude}
				bind:longitude={values.longitude}
				bind:geohash={values.geohash}
				label="Store Address"
			></LocationSearch>
			{#if errors.address}
				<p class="text-xs text-error-400">{errors.address}</p>
			{/if}

			<!-- Country -->
			<label class="label">
				<span>Country</span>
				<select class="select" bind:value={values.region}>
					{#each Object.values(COUNTRY_DETAILS) as [code, name] (code)}
						<option value={code}>{name}</option>
					{/each}
				</select>
				{#if errors.region}
					<p class="text-xs text-error-400">{errors.region}</p>
				{/if}
			</label>

			<div class="flex flex-row gap-4">
				<!-- Latitude -->
				<label class="label">
					<span>Latitude</span>
					<input
						class="input"
						type="text"
						bind:value={values.longitude}
						on:change={onManualLatLng}
					/>
				</label>
				<!-- Longitude -->
				<label class="label">
					<span>Longitude</span>
					<input
						class="input"
						type="text"
						bind:value={values.latitude}
						on:change={onManualLatLng}
					/>
				</label>
				<!-- Geohash -->
				<label class="label">
					<span>Geohash</span>
					<input class="input" type="text" disabled bind:value={values.geohash} />
				</label>
			</div>
			{#if errors.latitude || errors.longitude || errors.geohash}
				<p class="text-xs text-error-400">{errors.latitude}</p>
			{/if}
		</form>
		<!-- prettier-ignore -->
		<footer class="modal-footer p-4 {parent.regionFooter}">
			<button class="btn {parent.buttonNeutral}" on:click={parent.onClose}>Maybe later</button>
			<button class="btn {parent.buttonPositive}" form="createStoreForm" type="submit">Create Store</button>
		</footer>
	</div>
{/if}

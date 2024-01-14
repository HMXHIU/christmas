<script lang="ts">
	import { onMount } from 'svelte';
	import { COUNTRY_DETAILS } from '../../../lib/user-device-client/defs';
	import ngeohash from 'ngeohash';
	import { Loader } from '@googlemaps/js-api-loader';

	export let label: string = '';
	export let address: string = '';
	export let region: string | null = null;
	export let countryName: string | null = null;
	export let latitude: number | null = null;
	export let longitude: number | null = null;
	export let geohash: string | null = null;

	let locationInput: HTMLInputElement;

	onMount(() => {
		setTimeout(async () => {
			// Google maps
			const loader = new Loader({
				apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
				version: 'weekly'
			});
			const placesLibrary = await loader.importLibrary('places');

			// Initialize search box on input element (Note: `input` might not be rendered yet, thus the delay)
			const searchBox = new placesLibrary.SearchBox(locationInput);
			searchBox.addListener('places_changed', () => {
				const places = searchBox.getPlaces();
				if (places != null && places.length != 0) {
					const place = places[0];
					latitude = place.geometry?.location?.lat() || null;
					longitude = place.geometry?.location?.lng() || null;

					// set `address` for parent form
					address = place['formatted_address'] || '';
					const address_components = place['address_components'] || [];

					for (const component of address_components) {
						if (component.types.includes('country')) {
							[region, countryName] = COUNTRY_DETAILS[component.short_name];
							break;
						}
					}

					if (latitude != null && longitude != null) {
						geohash = ngeohash.encode(latitude, longitude, 6);
					}
				}
			});
		}, 200);
	});
</script>

<label class="label" for="location">
	<span>{label}</span>
	<input
		id="location"
		class="input"
		type="text"
		bind:this={locationInput}
		bind:value={address}
		placeholder="Your Store's Address"
	/>
</label>

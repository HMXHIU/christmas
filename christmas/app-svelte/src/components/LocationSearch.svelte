<script lang="ts">
	import { onMount } from 'svelte';
	import { COUNTRY_DETAILS } from '../../../lib/user-device-client/defs';
	import ngeohash from 'ngeohash';
	import type { Location } from '../../../lib/user-device-client/types';
	import { Loader } from '@googlemaps/js-api-loader';

	export let label: string = '';
	export let address: string = '';
	export let required: boolean = false;
	export let location: Location | null = null;
	export let countryCode: string | null = null;
	export let countryName: string | null = null;

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
					const lat = place.geometry?.location?.lat();
					const lng = place.geometry?.location?.lng();

					// set `address` for parent form
					address = place['formatted_address'] || '';
					const address_components = place['address_components'] || [];

					for (const component of address_components) {
						if (component.types.includes('country')) {
							[countryCode, countryName] = COUNTRY_DETAILS[component.short_name];
							break;
						}
					}

					if (lat != null && lng != null && countryCode && countryName) {
						location = {
							geohash: ngeohash.encode(lat, lng, 6),
							geolocationCoordinates: {
								latitude: lat,
								longitude: lng,
								accuracy: 0,
								altitude: null,
								altitudeAccuracy: null,
								heading: null,
								speed: null
							},
							country: {
								code: countryCode,
								name: countryName
							}
						};
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
		{required}
	/>
</label>

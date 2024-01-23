<script lang="ts">
    import { onMount } from "svelte";
    import { COUNTRY_DETAILS } from "$lib/clients/user-device-client/defs";
    import ngeohash from "ngeohash";
    import { Loader } from "@googlemaps/js-api-loader";
    import { Autocomplete } from "@skeletonlabs/skeleton";
    import type {
        AutocompleteOption,
        PopupSettings,
    } from "@skeletonlabs/skeleton";

    import { throttle } from "lodash";

    export let label: string = "";
    export let address: string = "";
    export let region: string | null = null;
    export let countryName: string | null = null;
    export let latitude: number | null = null;
    export let longitude: number | null = null;
    export let geohash: string | null = null;

    let map: HTMLDivElement;

    let addressOptions: AutocompleteOption<string>[] = [];

    let popupSettings: PopupSettings = {
        event: "focus-click",
        target: "popupAutocomplete",
        placement: "bottom",
    };

    let placesService: google.maps.places.PlacesService;

    const findPlaceFromQuery = throttle((query) => {
        placesService?.findPlaceFromQuery(
            {
                query: query || "",
                fields: ["name", "formatted_address", "place_id"],
            },
            (results, status) => {
                if (
                    status === google.maps.places.PlacesServiceStatus.OK &&
                    results
                ) {
                    // Update autocomplete options
                    addressOptions = results.map(
                        ({ formatted_address, name, place_id }) => {
                            return {
                                label: `${name}, ${formatted_address}`,
                                value: place_id || "",
                                meta: {
                                    name,
                                    formatted_address,
                                    place_id,
                                },
                            };
                        },
                    );
                } else {
                    console.warn(status);
                }
            },
        );
    }, 1000);

    function searchAddress(event: Event) {
        findPlaceFromQuery((event.target as HTMLInputElement).value);
    }

    function onSelectAddress(event: CustomEvent) {
        const { place_id, name, formatted_address } = event.detail.meta;

        address = `${name}, ${formatted_address}`;

        placesService.getDetails(
            {
                placeId: place_id,
                fields: ["address_components", "geometry.location"],
            },
            (place, status) => {
                if (
                    status == google.maps.places.PlacesServiceStatus.OK &&
                    place
                ) {
                    const { geometry, address_components } = place;

                    for (const component of address_components || []) {
                        if (component.types.includes("country")) {
                            [region, countryName] =
                                COUNTRY_DETAILS[component.short_name];
                            break;
                        }
                    }
                    latitude = geometry?.location?.lat() || null;
                    longitude = geometry?.location?.lng() || null;
                    if (latitude != null && longitude != null) {
                        geohash = ngeohash.encode(latitude, longitude, 6);
                    }
                }
            },
        );
    }

    onMount(async () => {
        // Initialize google maps placesService
        const loader = new Loader({
            apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
            version: "weekly",
        });
        const placesLibrary = await loader.importLibrary("places");
        placesService = new placesLibrary.PlacesService(map);
    });
</script>

<label class="label" for="location">
    <span>{label}</span>
    <!-- Input -->
    <input
        class="input autocomplete"
        type="search"
        name="autocomplete-search"
        autocomplete="off"
        bind:value={address}
        on:keyup={searchAddress}
        placeholder="Search Address..."
    />
    <!-- Autocomplete options -->
    <div
        class="card w-full max-w-sm max-h-48 p-3 overflow-y-auto"
        tabindex="-1"
    >
        <Autocomplete
            bind:options={addressOptions}
            on:selection={onSelectAddress}
        />
    </div>
</label>

<div bind:this={map} class="hidden w-0 h-0"></div>

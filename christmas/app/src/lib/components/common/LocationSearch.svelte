<script lang="ts">
    import { PUBLIC_GOOGLE_MAPS_API_KEY } from "$env/static/public";
    import * as Command from "$lib/components/ui/command";
    import { COUNTRY_DETAILS } from "$lib/userDeviceClient/defs";
    import { Loader } from "@googlemaps/js-api-loader";
    import { throttle } from "lodash-es";
    import ngeohash from "ngeohash";
    import { onMount, tick } from "svelte";

    export let address: string = "";
    export let region: string | null = null;
    export let countryName: string | null = null;
    export let latitude: number | null = null;
    export let longitude: number | null = null;
    export let geohash: string | null = null;

    let map: HTMLDivElement;

    interface AddressOption {
        label: string;
        value: string;
        meta: { name: string; formatted_address: string; place_id: string };
    }
    export let addressOptions: AddressOption[] = [];

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
                                    name: name || "",
                                    formatted_address: formatted_address || "",
                                    place_id: place_id || "",
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

    function focusOn(triggerId: string) {
        tick().then(() => {
            document.getElementById(triggerId)?.focus();
        });
    }

    function searchAddress(event: Event) {
        findPlaceFromQuery((event.target as HTMLInputElement).value);
    }

    function onSelectAddress({
        place_id,
        name,
        formatted_address,
    }: {
        place_id: string;
        name: string;
        formatted_address: string;
    }) {
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
            apiKey: PUBLIC_GOOGLE_MAPS_API_KEY,
            version: "weekly",
        });
        const placesLibrary = await loader.importLibrary("places");
        placesService = new placesLibrary.PlacesService(map);
    });
</script>

<Command.Root shouldFilter={false} onKeydown={searchAddress}>
    <Command.Input
        bind:value={address}
        placeholder="Search Address..."
        autocomplete="off"
        id="autocomplete-search"
    />
    <Command.Group>
        {#each addressOptions as option (option.value)}
            <Command.Item
                value={option.value}
                onSelect={() => {
                    onSelectAddress(option.meta);
                    focusOn("autocomplete-search");
                    addressOptions = []; // close the dropdown
                }}
            >
                {option.label}
            </Command.Item>
        {/each}
    </Command.Group>
</Command.Root>

<div bind:this={map} class="hidden w-0 h-0"></div>

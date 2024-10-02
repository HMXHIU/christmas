<script lang="ts">
    import {
        CreateStoreSchema,
        MAX_STORE_NAME_LENGTH,
        type CreateStore,
    } from "$lib/community/types";
    import ImageInput from "$lib/components/common/ImageInput.svelte";
    import LocationSearch from "$lib/components/common/LocationSearch.svelte";
    import { Button } from "$lib/components/ui/button";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import * as Select from "$lib/components/ui/select";
    import { Separator } from "$lib/components/ui/separator";
    import { Textarea } from "$lib/components/ui/textarea";
    import { COUNTRY_DETAILS } from "$lib/userDeviceClient/defs";
    import { parseZodErrors } from "$lib/utils";
    import { Dialog as BitsDialog } from "bits-ui";
    import { uniqWith } from "lodash";
    import ngeohash from "ngeohash";
    import { onMount } from "svelte";
    import { stores, userDeviceClient } from "../../../store";

    export let onCreateStore: (values: CreateStore) => Promise<void>;

    let openDialog: boolean = false;
    let name: string = "";
    let description: string = "";
    let address: string = "";
    let region: { value: string; label: string } = { value: "", label: "" };
    let latitude: number | null = null;
    let longitude: number | null = null;
    let geohash: string | null = null;
    let image: string | null = null;

    let errors: {
        name?: string;
        description?: string;
        address?: string;
        region?: string;
        longitude?: string;
        latitude?: string;
        geohash?: string;
        image?: string;
    } = {};

    // Update geohash if user manually changes latitude or longitude
    if (latitude != null && longitude != null) {
        geohash = ngeohash.encode(latitude, longitude, 6);
    }

    onMount(async () => {
        const regionCode = $userDeviceClient?.location?.country?.code ?? "USA";
        region = {
            value: regionCode,
            label: COUNTRY_DETAILS[regionCode][1],
        };
        latitude =
            $userDeviceClient?.location?.geolocationCoordinates?.latitude ||
            null;
        longitude =
            $userDeviceClient?.location?.geolocationCoordinates?.longitude ||
            null;
        geohash = $userDeviceClient?.location?.geohash ?? "";
    });

    async function onSubmit() {
        try {
            const createStoreParams = await CreateStoreSchema.parse({
                name,
                description,
                address,
                latitude,
                longitude,
                image,
                geohash,
                region: region?.value,
            });
            errors = {};
            await onCreateStore(createStoreParams);
            openDialog = false;
        } catch (err) {
            errors = parseZodErrors(err);
        }
    }

    function onManualLatLng(ev: Event) {
        if (latitude != null && longitude != null) {
            geohash = ngeohash.encode(latitude, longitude, 6);
        }
    }
</script>

<Dialog.Root bind:open={openDialog}>
    <Dialog.Trigger>
        <Button class="mx-auto my-12">
            {$stores.length > 0
                ? "Start Another Community Store"
                : "Start By Creating A Community Store"}
        </Button>
    </Dialog.Trigger>

    <Dialog.Content class="sm:max-w-[425px]">
        <Dialog.Header>
            <Dialog.Title>Create Store</Dialog.Title>
            <Dialog.Description>
                You can create your own community store to promote whatever you
                are selling, mint campaign coupons, or give stuff away for free
                stuff. Pay it forward.
            </Dialog.Description>
        </Dialog.Header>
        <Separator />

        <div class="flex flex-col gap-4">
            <!-- Store name -->
            <div class="grid w-full gap-2">
                <Label for="store-name">Store Name</Label>
                <Input
                    id="store-name"
                    type="text"
                    maxlength={MAX_STORE_NAME_LENGTH}
                    bind:value={name}
                    placeholder="Your community store"
                    autocomplete="off"
                />
                {#if errors.name}
                    <p class="text-xs text-destructive">{errors.name}</p>
                {/if}
            </div>

            <!-- Store description -->
            <div class="grid w-full gap-2">
                <Label for="store-desc">Store Description</Label>
                <Textarea
                    placeholder="What is your community store about?"
                    id="store-desc"
                    rows={4}
                    maxlength={400}
                    bind:value={description}
                    autocomplete="off"
                />
                {#if errors.description}
                    <p class="text-xs text-destructive">{errors.description}</p>
                {/if}
            </div>

            <!-- Store image -->
            <div class="grid w-full gap-2">
                <Label for="store-image">Store Logo</Label>
                <div id="store-image">
                    <ImageInput message="150x150" bind:image></ImageInput>
                </div>
                {#if errors.image}
                    <p class="text-xs text-destructive">{errors.image}</p>
                {/if}
            </div>

            <!-- Address -->
            <div class="grid w-full gap-2">
                <Label for="location-search">Store Address</Label>
                <div id="location-search">
                    <LocationSearch
                        bind:region={region.value}
                        bind:address
                        bind:latitude
                        bind:longitude
                        bind:geohash
                    ></LocationSearch>
                </div>
                {#if errors.address}
                    <p class="text-xs text-destructive">{errors.address}</p>
                {/if}
            </div>

            <!-- Country -->
            <div class="grid w-full gap-2">
                <Label for="country">Country</Label>
                <div id="country">
                    <Select.Root portal={null} bind:selected={region}>
                        <Select.Trigger class="w-[180px]">
                            <Select.Value placeholder="Country" />
                        </Select.Trigger>
                        <Select.Content class="max-h-[300px] overflow-y-auto">
                            <Select.Group>
                                {#each uniqWith(Object.values(COUNTRY_DETAILS), (x, y) => x[0] === y[0]) as [code, name] (code)}
                                    <Select.Item value={code} label={name}
                                        >{name}</Select.Item
                                    >
                                {/each}
                            </Select.Group>
                        </Select.Content>
                        <Select.Input name="favoriteFruit" />
                    </Select.Root>
                </div>
                {#if errors.region}
                    <p class="text-xs text-destructive">{errors.region}</p>
                {/if}
            </div>

            <div class="flex flex-row gap-4">
                <!-- Latitude -->
                <div class="grid gap-2">
                    <Label for="latitude">Latitude</Label>
                    <Input
                        id="latitude"
                        type="text"
                        bind:value={longitude}
                        on:change={onManualLatLng}
                    />
                </div>
                <!-- Longitude -->
                <div class="grid gap-2">
                    <Label for="longitude">Longitude</Label>
                    <Input
                        id="longitude"
                        type="text"
                        bind:value={latitude}
                        on:change={onManualLatLng}
                    />
                </div>
                <!-- Geohash -->
                <div class="grid gap-2">
                    <Label for="geohash">Geohash</Label>
                    <Input
                        id="geohash"
                        type="text"
                        disabled
                        bind:value={geohash}
                    />
                </div>
            </div>
            {#if errors.latitude || errors.longitude || errors.geohash}
                <p class="text-xs text-destructive">{errors.latitude}</p>
            {/if}
        </div>

        <Dialog.Footer class="flex flex-row justify-end gap-4">
            <BitsDialog.Close>
                <Button>Maybe Later</Button>
            </BitsDialog.Close>
            <Button type="submit" on:click={onSubmit}>Create Store</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

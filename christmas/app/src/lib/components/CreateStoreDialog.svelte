<script lang="ts">
    import { onMount } from "svelte";
    import {
        STORE_NAME_SIZE,
        STRING_PREFIX_SIZE,
    } from "$lib/anchorClient/defs";
    import ImageInput from "./ImageInput.svelte";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Input } from "$lib/components/ui/input";
    import * as Select from "$lib/components/ui/select";
    import { Button } from "$lib/components/ui/button";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Dialog as BitsDialog } from "bits-ui";
    import { Label } from "$lib/components/ui/label";
    import { stores, userDeviceClient } from "../../store";
    import ngeohash from "ngeohash";
    import LocationSearch from "./LocationSearch.svelte";
    import { COUNTRY_DETAILS } from "$lib/clients/user-device-client/defs";
    import * as yup from "yup";
    import type { CreateStoreParams } from "$lib/community/types";

    export let onCreateStore: (values: CreateStoreParams) => void;

    let openDialog: boolean = false;

    let name: string = "";
    let description: string = "";
    let address: string = "";
    let region: { value: string; label: string } = { value: "", label: "" };
    let latitude: number | null = null;
    let longitude: number | null = null;
    let geohash: string | null = null;
    let logo: File | null = null;

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
    if (latitude != null && longitude != null) {
        geohash = ngeohash.encode(latitude, longitude, 6);
    }

    const schema = yup.object().shape({
        name: yup.string().required("Your store needs a name."),
        description: yup.string().required("Your store needs a description."),
        address: yup.string().required("Your store needs an address."),
        region: yup
            .string()
            .required("Your store needs to belong to a region."),
        latitude: yup.number().required("Your store needs coordinates."),
        longitude: yup.number().required("Your store needs coordinates."),
        geohash: yup.string().required("Your store needs a geohash."),
        logo: yup
            .mixed()
            .test(
                "fileSize",
                "The file is too large",
                (value: any) => value?.size <= 1000000,
            )
            .test(
                "fileType",
                "We only support .png, .jpg, .jpeg",
                (value: any) =>
                    value &&
                    ["image/png", "image/jpg", "image/jpeg"].includes(
                        value.type,
                    ),
            )
            .required("Your store needs a logo."),
    });

    onMount(async () => {
        // Use default location on initial load
        const regionCode = String.fromCharCode(
            ...($userDeviceClient?.location?.country?.code || []),
        );
        region = {
            value: regionCode,
            label: regionCode,
        };
        latitude =
            $userDeviceClient?.location?.geolocationCoordinates?.latitude ||
            null;
        longitude =
            $userDeviceClient?.location?.geolocationCoordinates?.longitude ||
            null;
        geohash = String.fromCharCode(
            ...($userDeviceClient?.location?.geohash || []),
        );
    });

    async function onSubmit() {
        try {
            const createStoreParams = await schema.validate(
                {
                    name,
                    description,
                    address,
                    region: region?.value,
                    latitude,
                    longitude,
                    geohash,
                    logo,
                },
                { abortEarly: false }, // `abortEarly: false` to get all the errors
            );
            errors = {};
            await onCreateStore(createStoreParams as CreateStoreParams);
            openDialog = false;
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

        <div class="flex flex-col gap-4">
            <!-- Store name -->
            <div class="grid w-full gap-2">
                <Label for="store-name">Store Name</Label>
                <Input
                    id="store-name"
                    type="text"
                    maxlength={STORE_NAME_SIZE - STRING_PREFIX_SIZE}
                    bind:value={name}
                    placeholder="Your community store"
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
                />
                {#if errors.description}
                    <p class="text-xs text-destructive">{errors.description}</p>
                {/if}
            </div>

            <!-- Store logo -->
            <div class="grid w-full gap-2">
                <Label for="store-logo">Store Logo</Label>
                <div id="store-logo">
                    <ImageInput message="150x150" bind:file={logo}></ImageInput>
                </div>
            </div>

            <hr />

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
            </div>
            {#if errors.address}
                <p class="text-xs text-destructive">{errors.address}</p>
            {/if}

            <!-- Country -->
            <div class="grid w-full gap-2">
                <Label for="country">Country</Label>
                <div id="country">
                    <Select.Root portal={null} bind:selected={region}>
                        <Select.Trigger class="w-[180px]">
                            <Select.Value placeholder="Country" />
                        </Select.Trigger>
                        <Select.Content>
                            <Select.Group>
                                <Select.Label>Fruits</Select.Label>
                                {#each Object.entries(COUNTRY_DETAILS) as [key, [code, name]] (key)}
                                    <Select.Item value={code} label={name}
                                        >{name}</Select.Item
                                    >
                                {/each}
                            </Select.Group>
                        </Select.Content>
                        <Select.Input name="favoriteFruit" />
                    </Select.Root>
                    {#if errors.region}
                        <p class="text-xs text-destructive">{errors.region}</p>
                    {/if}
                </div>
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

        <Dialog.Footer>
            <BitsDialog.Close>
                <Button>Maybe Later</Button>
            </BitsDialog.Close>
            <Button type="submit" on:click={onSubmit}>Create Store</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

<script lang="ts">
    import {
        COUPON_NAME_SIZE,
        STRING_PREFIX_SIZE,
    } from "$lib/anchorClient/defs";
    import DateInput from "$lib/components/common/DateInput.svelte";
    import ImageInput from "$lib/components/common/ImageInput.svelte";
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Dialog as BitsDialog } from "bits-ui";

    import type { Account, Store } from "$lib/anchorClient/types";
    import type { CreateCouponParams } from "$lib/community";
    import CouponSvg from "$lib/components/svg/CouponSvg.svelte";
    import PlusSvg from "$lib/components/svg/PlusSvg.svelte";
    import { Separator } from "$lib/components/ui/separator";
    import { parseZodErrors } from "$lib/utils";
    import {
        getLocalTimeZone,
        today,
        type DateValue,
    } from "@internationalized/date";
    import { z } from "zod";

    export let store: Account<Store>;
    export let onCreateCoupon: (
        createCouponParams: CreateCouponParams,
    ) => Promise<void>;

    const CreateCouponSchema = z.object({
        name: z.string().min(1, "Coupon name is required"),
        description: z.string().min(1, "Coupon description is required"),
        validFrom: z.coerce.date({
            required_error: "Coupon start date is required",
        }),
        validTo: z.coerce.date({
            required_error: "Coupon expiry date is required",
        }),
        image: z.string().min(1, "Coupon image is required"),
    });

    let name: string = "";
    let description: string = "";
    let validFrom: DateValue = today(getLocalTimeZone());
    let validTo: DateValue = today(getLocalTimeZone()).add({ months: 6 });
    let image: string | null;

    let errors: {
        name?: string;
        description?: string;
        validTo?: string;
        validFrom?: string;
        image?: string;
    } = {};

    let openDialog = false;

    async function onSubmit() {
        try {
            const createCouponParams = await CreateCouponSchema.parse({
                name,
                description,
                validFrom,
                validTo,
                image,
                store,
            });
            errors = {};
            await onCreateCoupon({
                ...createCouponParams,
                store,
            });
            openDialog = false;
        } catch (err) {
            errors = parseZodErrors(err);
        }
    }
</script>

<Dialog.Root bind:open={openDialog}>
    <Dialog.Trigger>
        <div class="my-auto relative">
            <Button
                variant="default"
                size="icon"
                class="h-10 w-10 rounded-full"
            >
                <CouponSvg />
            </Button>
            <Badge
                variant="secondary"
                class="rounded-full p-0 absolute -right-1 z-10"
            >
                <PlusSvg />
            </Badge>
        </div>
    </Dialog.Trigger>

    <Dialog.Content class="sm:max-w-[425px]">
        <Dialog.Header>
            <Dialog.Title>Create Coupon</Dialog.Title>
            <Dialog.Description>
                People in the vincinity of your store will be able to claim your
                coupon and redeem it at your store.
            </Dialog.Description>
        </Dialog.Header>

        <Separator />

        <div class="flex flex-col gap-4">
            <!-- Coupon name -->
            <div class="grid w-full gap-2">
                <Label for="coupon-name">Coupon Name</Label>
                <Input
                    id="coupon-name"
                    type="text"
                    maxlength={COUPON_NAME_SIZE - STRING_PREFIX_SIZE}
                    bind:value={name}
                    placeholder="What is your coupon called?"
                />
                {#if errors.name}
                    <p class="text-xs text-destructive">{errors.name}</p>
                {/if}
            </div>

            <!-- Coupon description -->
            <div class="grid w-full gap-2">
                <Label for="coupon-desc">Coupon Description</Label>
                <Textarea
                    placeholder="What is the coupon about?"
                    id="coupon-desc"
                    rows={4}
                    maxlength={400}
                    bind:value={description}
                />
                {#if errors.description}
                    <p class="text-xs text-destructive">
                        {errors.description}
                    </p>
                {/if}
            </div>

            <!-- Coupon image -->
            <div class="grid w-full gap-2">
                <Label for="coupon-image">Coupon Image</Label>
                <div id="coupon-image">
                    <ImageInput message="150x150" bind:image></ImageInput>
                </div>
                {#if errors.image}
                    <p class="text-xs text-destructive">
                        {errors.image}
                    </p>
                {/if}
            </div>

            <!-- Coupon Validity Period -->
            <div class="grid grid-cols-2 w-full gap-2">
                <!-- Valid From -->
                <div id="valid-from" class=" grid gap-2">
                    <Label for="valid-from">Valid From</Label>
                    <DateInput bind:value={validFrom}></DateInput>
                </div>
                <!-- Valid To -->
                <div id="valid-to" class="grid gap-2">
                    <Label for="valid-to">Valid To</Label>
                    <DateInput bind:value={validTo}></DateInput>
                </div>
            </div>
            {#if errors.validFrom || errors.validTo}
                <p class="text-xs text-error-400">{errors.validFrom}</p>
            {/if}
        </div>

        <Dialog.Footer class="flex flex-row justify-end gap-4">
            <BitsDialog.Close>
                <Button>Maybe Later</Button>
            </BitsDialog.Close>
            <Button type="submit" on:click={onSubmit}>Create Coupon</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

<script lang="ts">
    import type { Account, Coupon } from "$lib/anchorClient/types";
    import type { MintCouponParams } from "$lib/community";
    import { Button } from "$lib/components/ui/button";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Separator } from "$lib/components/ui/separator";
    import { parseZodErrors } from "$lib/utils";
    import { Dialog as BitsDialog } from "bits-ui";
    import { onMount } from "svelte";
    import { z } from "zod";

    export let coupon: Account<Coupon>;

    export let onMintCoupon: (
        mintCouponParams: MintCouponParams,
    ) => Promise<void>;

    let openDialog = false;

    let numTokens: number = 1;

    let errors: {
        numTokens?: number;
    } = {};

    const schema = z.object({
        numTokens: z.coerce.number().int().min(1).positive(),
    });

    onMount(() => {});

    async function onSubmit() {
        try {
            const mintCouponParams = await schema.parse({ numTokens });
            errors = {};
            await onMintCoupon({ ...mintCouponParams, coupon });
            openDialog = false;
        } catch (err) {
            errors = parseZodErrors(err);
        }
    }
</script>

<Dialog.Root bind:open={openDialog}>
    <Dialog.Trigger>
        <Button>Add Supply</Button>
    </Dialog.Trigger>

    <Dialog.Content class="sm:max-w-[425px]">
        <Dialog.Header>
            <Dialog.Title>Supply To Add</Dialog.Title>
            <Dialog.Description>
                Increase the number of coupons.
            </Dialog.Description>
        </Dialog.Header>

        <Separator />

        <div class="flex flex-col gap-4">
            <!-- Coupon name -->
            <div class="grid w-full gap-2">
                <Label for="supply">Supply To Add</Label>
                <Input
                    id="supply"
                    type="number"
                    min={1}
                    bind:value={numTokens}
                />
                {#if errors.numTokens}
                    <p class="text-xs text-destructive">{errors.numTokens}</p>
                {/if}
            </div>
        </div>

        <Dialog.Footer class="flex flex-row justify-end gap-4">
            <BitsDialog.Close>
                <Button>Maybe Later</Button>
            </BitsDialog.Close>
            <Button type="submit" on:click={onSubmit}>Add Supply</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

<script lang="ts">
    import { onMount } from "svelte";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { Dialog as BitsDialog } from "bits-ui";
    import * as yup from "yup";
    import type { Account, Coupon } from "$lib/anchorClient/types";
    import { Separator } from "$lib/components/ui/separator";
    import { Label } from "$lib/components/ui/label";
    import { Input } from "$lib/components/ui/input";
    import type { MintCouponParams } from "$lib/community/types";

    export let coupon: Account<Coupon>;
    export let supply: number;
    export let balance: number;

    export let onMintCoupon: (
        mintCouponParams: MintCouponParams,
    ) => Promise<void>;

    let openDialog = false;

    let numTokens: number = 1;

    let errors: {
        numTokens?: number;
    } = {};

    const schema = yup.object().shape({
        numTokens: yup.number().required("Minimum of 1."),
    });

    onMount(() => {});

    function extractErrors(err: any) {
        return err.inner.reduce((acc: any, err: any) => {
            return { ...acc, [err.path]: err.message };
        }, {});
    }

    async function onSubmit() {
        try {
            const mintCouponParams = await schema.validate(
                { numTokens },
                { abortEarly: false }, // `abortEarly: false` to get all the errors
            );
            errors = {};
            await onMintCoupon({ ...mintCouponParams, coupon });
            openDialog = false;
        } catch (err) {
            errors = extractErrors(err);
        }
    }
</script>

<Dialog.Root bind:open={openDialog}>
    <Dialog.Trigger>
        <Button on:click={onSubmit}>Add Supply</Button>
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

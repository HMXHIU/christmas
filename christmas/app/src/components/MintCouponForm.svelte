<script lang="ts">
    import type { SvelteComponent } from "svelte";
    import { onMount } from "svelte";
    import { getModalStore } from "@skeletonlabs/skeleton";

    import * as yup from "yup";
    import type { Account, Coupon } from "$lib/anchorClient/types";

    const modalStore = getModalStore();

    export let parent: SvelteComponent;

    let coupon: Account<Coupon> = $modalStore[0].meta.coupon;
    let supply: number = $modalStore[0].meta.supply;
    let balance: number = $modalStore[0].meta.balance;

    let values: {
        numTokens?: number;
    } = {};

    let errors: {
        numTokens?: number;
    } = {};

    const schema = yup.object().shape({
        numTokens: yup.number().required("Minimum of 1."),
    });

    // Only use default on initial load
    onMount(() => {
        values = {
            numTokens: 1,
        };
    });

    async function onCreateCoupon() {
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
</script>

{#if $modalStore[0]}
    <div class="card space-y-4 shadow-xl w-11/12">
        <form
            class="p-4 space-y-4 rounded-container-token"
            id="addSupplyForm"
            on:submit|preventDefault={onCreateCoupon}
        >
            <!-- Supply -->
            <label class="label">
                <span>Supply To Add</span>
                <input
                    class="input"
                    type="number"
                    min={1}
                    bind:value={values.numTokens}
                />
                {#if errors.numTokens}
                    <p class="text-xs text-error-400">{errors.numTokens}</p>
                {/if}
            </label>
            <p class="text-xs italic text-right text-success-400 mt-1 mr-1">
                {balance}/{supply} left
            </p>
        </form>
        <!-- prettier-ignore -->
        <footer class="modal-footer p-4 {parent.regionFooter}">
			<button class="btn {parent.buttonNeutral}" on:click={parent.onClose}>Maybe later</button>
			<button class="btn {parent.buttonPositive}" form="addSupplyForm" type="submit">Add Supply</button>
		</footer>
    </div>
{/if}

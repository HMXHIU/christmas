<script lang="ts">
	import type { SvelteComponent } from 'svelte';
	import { onMount } from 'svelte';
	import { getModalStore } from '@skeletonlabs/skeleton';
	import { COUPON_NAME_SIZE, STRING_PREFIX_SIZE } from '../../../lib/anchor-client/defs';
	import ImageInput from './ImageInput.svelte';
	import DateInput from './DateInput.svelte';

	import * as yup from 'yup';

	const modalStore = getModalStore();

	export let parent: SvelteComponent;

	let values: {
		name?: string;
		description?: string;
		validFrom?: Date;
		validTo?: Date;
		image?: File | null;
	} = {};

	let errors: {
		name?: string;
		description?: string;
		validTo?: string;
		validFrom?: string;
	} = {};

	const schema = yup.object().shape({
		name: yup.string().required('Your coupon needs a name.'),
		description: yup.string().required('Your coupon needs a description.'),
		validFrom: yup.date().required('Your coupon needs a validity period.'),
		validTo: yup.date().required('Your coupon needs a validity period.')
	});

	// Only use default validity period on initial load
	onMount(() => {
		// Default validity period
		const currentDate = new Date();
		const defaultValidTo = new Date();
		defaultValidTo.setMonth(currentDate.getMonth() + 6);

		values = {
			validFrom: currentDate,
			validTo: defaultValidTo
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
			id="createCouponForm"
			on:submit|preventDefault={onCreateCoupon}
		>
			<!-- Coupon name -->
			<label class="label">
				<span>Coupon Name</span>
				<input
					class="input"
					type="text"
					maxlength={COUPON_NAME_SIZE - STRING_PREFIX_SIZE}
					bind:value={values.name}
					placeholder="Give it a catchy name!"
				/>
				{#if errors.name}
					<p class="text-xs text-error-400">{errors.name}</p>
				{/if}
			</label>

			<!-- Coupon description -->
			<label class="label">
				<span>Coupon Description</span>
				<textarea
					class="textarea"
					rows="4"
					placeholder="What is the coupon about?"
					maxlength={400}
					bind:value={values.description}
				/>
				{#if errors.description}
					<p class="text-xs text-error-400">{errors.description}</p>
				{/if}
			</label>

			<!-- Coupon image -->
			<ImageInput label="Coupon Image" message="150x150" bind:file={values.image}></ImageInput>

			<hr />

			<!-- Coupon Validity Period -->
			<div class="flex flex-row gap-4">
				<!-- Valid From -->
				<DateInput label="Valid From" bind:value={values.validFrom}></DateInput>
				<!-- Valid To -->
				<DateInput label="Valid To" bind:value={values.validTo}></DateInput>
			</div>
			{#if errors.validFrom || errors.validTo}
				<p class="text-xs text-error-400">{errors.validFrom}</p>
			{/if}
		</form>
		<!-- prettier-ignore -->
		<footer class="modal-footer p-4 {parent.regionFooter}">
			<button class="btn {parent.buttonNeutral}" on:click={parent.onClose}>Maybe later</button>
			<button class="btn {parent.buttonPositive}" form="createCouponForm" type="submit">Create Coupon</button>
		</footer>
	</div>
{/if}

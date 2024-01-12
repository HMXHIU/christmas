<script lang="ts">
	import { onMount } from 'svelte';

	export let width: number;
	export let height: number;
	export let data: string;
	export let image: string | null = null;

	let qrUrl: string;

	onMount(async () => {
		const module = await import('@solana/qr-code-styling');
		const QRCodeStyling = module.default;
		const qrCode = new QRCodeStyling({
			width,
			height,
			data,
			type: 'svg',
			dotsOptions: {
				color: '#4267b2',
				type: 'rounded'
			},
			backgroundOptions: {
				color: '#e9ebee'
			},
			...(image != null ? { imageOptions: { crossOrigin: 'anonymous', margin: 20 }, image } : {})
		});

		qrUrl = URL.createObjectURL((await qrCode.getRawData()) as Blob);
	});
</script>

{#await qrUrl then qrUrl}
	<img src={qrUrl} alt="verify redemption" />
{/await}

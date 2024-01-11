import { anchorClient, userDeviceClient, marketCoupons } from '../store';
import { get } from 'svelte/store';

export async function fetchMarketCoupons() {
	const ac = get(anchorClient);
	const dc = get(userDeviceClient);

	console.log('AAA', ac, dc);
	if (ac && dc?.location?.country?.code) {
		const coupons = await ac.getCoupons(dc.location.country.code);

		console.log('BBB', coupons);

		marketCoupons.update(() => coupons);
	}
}

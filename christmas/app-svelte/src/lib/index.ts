import { PublicKey } from '@solana/web3.js';
import type {
	Account,
	Coupon,
	CouponMetadata,
	StoreMetadata,
	TokenAccount
} from '../../../lib/anchor-client/types';
import { anchorClient, userDeviceClient, marketCoupons } from '../store';
import { get } from 'svelte/store';
import { getCouponMetadata, getStoreMetadata } from '../../../lib/utils';

export async function fetchMarketCoupons(): Promise<[Account<Coupon>, TokenAccount][]> {
	const ac = get(anchorClient);
	const dc = get(userDeviceClient);

	if (ac && dc?.location?.country?.code) {
		const coupons = await ac.getCoupons(dc.location.country.code);
		// update `marketCoupons` store
		marketCoupons.update(() => coupons);
		return coupons;
	}
	return [];
}

export async function fetchStoreMetadata(storePda: PublicKey): Promise<StoreMetadata> {
	const ac = get(anchorClient);
	const store = await ac!.getStoreByPda(storePda);
	const storeMetadata = await getStoreMetadata(store!);

	// update `storeMetadata` store (caching)

	return storeMetadata;
}

export async function fetchCouponMetadata(coupon: Coupon): Promise<CouponMetadata> {
	const couponMetadata = await getCouponMetadata(coupon);

	// update `couponMetadata` store (caching)

	return couponMetadata;
}

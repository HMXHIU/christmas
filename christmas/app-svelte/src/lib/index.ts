import { PublicKey } from '@solana/web3.js';
import type {
	Account,
	Coupon,
	CouponMetadata,
	StoreMetadata,
	TokenAccount
} from '../../../lib/anchor-client/types';
import { anchorClient, userDeviceClient, marketCoupons, claimedCoupons } from '../store';
import { get } from 'svelte/store';
import { generateQRCodeURL, getCouponMetadata, getStoreMetadata } from '../../../lib/utils';

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

export async function fetchClaimedCoupons(): Promise<[Account<Coupon>, number][]> {
	const ac = get(anchorClient);

	if (ac) {
		const coupons = await ac.getClaimedCoupons();
		// update `claimedCoupons` store
		claimedCoupons.update(() => coupons);
		return coupons;
	}
	return [];
}

export async function claimCoupon({
	coupon,
	numTokens
}: {
	coupon: Account<Coupon>;
	numTokens: number;
}) {
	const ac = get(anchorClient);
	const dc = get(userDeviceClient);

	if (ac && dc?.location?.country?.code) {
		// Claim from market, also creates a `User` using `region` and `geo`
		await ac.claimFromMarket(
			coupon.account.mint,
			numTokens,
			dc?.location.country.code,
			dc?.location.geohash
		);
		// TODO: handle error
	}
}

export async function redeemCoupon({
	coupon,
	numTokens
}: {
	coupon: Account<Coupon>;
	numTokens: number;
}): Promise<string | null> {
	const ac = get(anchorClient);

	if (ac) {
		// Redeem coupon
		const transactionResult = await ac.redeemCoupon({
			coupon: coupon.publicKey,
			mint: coupon.account.mint,
			numTokens
		});

		// Coupon already redeemed
		if (transactionResult.result.err != null) {
			return null;
		}

		// Generate and set redemptionQRCodeURL
		return generateQRCodeURL({
			signature: transactionResult.signature,
			wallet: ac.anchorWallet.publicKey.toString(),
			mint: coupon.account.mint.toString(),
			numTokens: String(numTokens)
		});
	}

	return null;
}

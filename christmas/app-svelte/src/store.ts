import { writable, readable } from 'svelte/store';
import type { AnchorClient } from '../../lib/anchor-client/anchorClient';

import type { Coupon, Account, TokenAccount } from '../../lib/anchor-client/types';

import { UserDeviceClient } from '../../lib/user-device-client/userDeviceClient';
import type { NFTClient } from '../../lib/nft-client/types';
import { NFTMinioClient } from '../../lib/nft-client/nftMinioClient';
import { NFTStorageClient } from '../../lib/nft-client/nftStorageClient';
import { SolanaConnect } from 'solana-connect';

export let solanaConnect = writable<SolanaConnect | null>(null);
export let anchorClient = writable<AnchorClient | null>(null);
export let userDeviceClient = writable<UserDeviceClient | null>(null);
export let nftClient = readable<NFTClient>(
	import.meta.env.DEV
		? new NFTMinioClient({
				accessKey: import.meta.env.VITE_MINIO_ACCESS_KEY,
				secretKey: import.meta.env.VITE_MINIO_SECRET_KEY,
				port: parseInt(import.meta.env.VITE_MINIO_PORT),
				endPoint: import.meta.env.VITE_MINIO_ENDPOINT,
				useSSL: JSON.parse(import.meta.env.VITE_MINIO_USE_SSL),
				bucket: import.meta.env.VITE_MINIO_BUCKET
			})
		: new NFTStorageClient({
				token: import.meta.env.VITE_NFT_STORAGE_TOKEN
			})
);
export let marketCoupons = writable<[Account<Coupon>, TokenAccount][]>([]);

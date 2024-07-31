import type { Account, Coupon, Store } from "$lib/anchorClient/types";
import type { MessageFeed } from "$lib/components/crossover/GameWindow";
import type { Ability } from "$lib/crossover/world/abilities";
import type {
    CouponMetadataSchema,
    StoreMetadataSchema,
} from "$lib/server/community/router";
import type {
    Item,
    Monster,
    Player,
    World,
} from "$lib/server/crossover/redis/entities";
import type { UserMetadataSchema } from "$lib/server/crossover/router";
import { UserDeviceClient } from "$lib/userDeviceClient";
import { writable } from "svelte/store";
import { z } from "zod";
import type {
    ActionEvent,
    FeedEvent,
    UpdateEntitiesEvent,
} from "./routes/api/crossover/stream/+server";

// Community
export let token = writable<string | null>(null); // jwt access token (cookies fallback, null if logged out)
export let userDeviceClient = writable<UserDeviceClient | null>(null);
export let marketCoupons = writable<[Account<Coupon>, number][]>([]);
export let claimedCoupons = writable<[Account<Coupon>, number][]>([]);
export let redeemedCoupons = writable<Record<string, string>>({});
export let stores = writable<Account<Store>[]>([]);
export let storesMetadata = writable<
    Record<string, z.infer<typeof StoreMetadataSchema>>
>({});
export let mintedCoupons = writable<
    Record<string, [Account<Coupon>, number, number][]>
>({});
export let couponsMetadata = writable<
    Record<string, z.infer<typeof CouponMetadataSchema>>
>({});
export let userMetadata = writable<z.infer<typeof UserMetadataSchema> | null>(
    null,
);

// Crossver
export let inGame = writable<boolean>(false);
export let player = writable<Player | null>(null);
export let playerAbilities = writable<Ability[]>([]);
export let playerInventoryItems = writable<Item[]>([]);
export let playerEquippedItems = writable<Item[]>([]);

export let playerEquipmentRecord = writable<Record<string, Item[]>>({});
export let playerRecord = writable<Record<string, Player>>({});
export let itemRecord = writable<Record<string, Item>>({});
export let monsterRecord = writable<Record<string, Monster>>({});

export let worldRecord = writable<Record<string, Record<string, World>>>({});
export let messageFeed = writable<MessageFeed[]>([]);
export let target = writable<Player | Monster | Item | null>(null);

export let entitiesEvent = writable<UpdateEntitiesEvent>();
export let actionEvent = writable<ActionEvent>();
export let feedEvent = writable<FeedEvent>();
export let loginEvent = writable<Player>();

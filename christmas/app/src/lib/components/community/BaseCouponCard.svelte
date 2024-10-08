<script lang="ts">
    import * as Avatar from "$lib/components/ui/avatar";
    import * as Card from "$lib/components/ui/card";

    export let couponName: string;
    export let couponNameSuffix: string | null = null;
    export let expiry: Date;
    export let couponDescription: string | null = null;
    export let couponImageUrl: string | null = null;
    export let remaining: number | null = null;
    export let supply: number | null = null;
    export let balance: number | null = null;
    export let distance: number | null = null;
    export let storeImageUrl: string | null = null;
    export let storeName: string | null = null;
    export let storeAddress: string | null = null;
    export let redemptionQRCodeURL: string | null = null;

    function getDistance(distance: number): string {
        if (distance) {
            if (distance < 0.1) {
                return "nearby";
            } else if (distance < 1) {
                return `${Math.trunc(distance * 1000)}m`;
            }
            return `${Math.round(distance)}km`;
        }
        return "";
    }
</script>

<Card.Root class="h-full flex flex-col justify-between">
    <Card.Header class="p-0">
        <!-- Coupon Image -->
        <div class="overflow-hidden relative">
            {#if couponImageUrl}
                <img
                    class="w-full {redemptionQRCodeURL ? 'blur-lg' : ''}"
                    src={couponImageUrl}
                    alt="coupon"
                />
            {:else if redemptionQRCodeURL == null}
                <div class="h-32 w-full flex">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        height="20"
                        width="20"
                        viewBox="0 0 512 512"
                        class="my-auto mx-auto fill-slate-400"
                    >
                        <path
                            d="M448 80c8.8 0 16 7.2 16 16V415.8l-5-6.5-136-176c-4.5-5.9-11.6-9.3-19-9.3s-14.4 3.4-19 9.3L202 340.7l-30.5-42.7C167 291.7 159.8 288 152 288s-15 3.7-19.5 10.1l-80 112L48 416.3l0-.3V96c0-8.8 7.2-16 16-16H448zM64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H64zm80 192a48 48 0 1 0 0-96 48 48 0 1 0 0 96z"
                        />
                    </svg>
                </div>
            {/if}
            {#if redemptionQRCodeURL}
                <div
                    class="btn-icon variant-filled absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-1"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="w-6 h-6"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z"
                        />
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z"
                        />
                    </svg>
                </div>
            {/if}
        </div>
        <!-- Coupon Info (expiry, distance, balance) -->
        <div class="px-3 gap-1">
            <!-- Expiry -->
            <p class="text-xs italic text-right text-muted-foreground">
                Expires
                {new Intl.DateTimeFormat("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                }).format(expiry)}
            </p>
            <!-- Distance -->
            {#if distance}
                <p class="text-xs text-right">
                    {getDistance(distance)}
                </p>
            {/if}
            <!-- Remaining -->
            {#if remaining}
                <p class="text-xs italic text-right">
                    {remaining} remaining
                </p>
            {/if}
            <!-- Supply/Balance -->
            {#if supply != null && balance != null}
                <p class="text-xs italic text-right">
                    {balance}/{supply} left
                </p>
            {/if}
        </div>
    </Card.Header>

    <div class="grow"></div>

    <!-- Coupon Name, Description -->
    <Card.Content class="flex flex-col p-3 gap-2">
        <div class="flex gap-2 flex-col place-self-start">
            <!-- Coupon Name -->
            <p class="text-left leading-tight">
                <span class="font-semibold">
                    {couponName}
                </span>
                {#if couponNameSuffix}
                    <span class="text-xs text-muted-foreground">
                        {couponNameSuffix}
                    </span>
                {/if}
            </p>
            <!-- Coupon Description -->
            {#if couponDescription}
                <p class="text-sm font-light">
                    {couponDescription}
                </p>
            {/if}
        </div>
    </Card.Content>

    <!-- Coupon Store -->
    {#if storeName}
        <Card.Footer class="flex flex-row gap-2 p-3">
            <!-- Store Avatar -->
            <Avatar.Root class="my-auto">
                <Avatar.Image src={storeImageUrl} alt={storeName} />
                <Avatar.Fallback>{storeName.slice(0, 2)}</Avatar.Fallback>
            </Avatar.Root>

            <!-- Store Name, Address -->
            <div class="flex flex-col gap-1 overflow-hidden text-left my-auto">
                <p class="text-sm font-bold">{storeName}</p>
                <p
                    class="text-xs text-ellipsis text-nowrap overflow-hidden text-muted-foreground"
                >
                    {storeAddress}
                </p>
            </div>
        </Card.Footer>
    {/if}

    <!-- Slot -->
    <slot />
</Card.Root>

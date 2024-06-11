<script lang="ts">
    import Wallet from "$lib/components/common/Wallet.svelte";
    import { Toaster } from "$lib/components/ui/sonner";
    import { UserDeviceClient } from "$lib/userDeviceClient";
    import { onMount } from "svelte";
    import "../app.postcss";
    import { userDeviceClient } from "../store";

    onMount(async () => {
        const client = new UserDeviceClient();
        await client.initialize();
        userDeviceClient.set(client);
    });
</script>

<!-- App Shell -->
<div class="h-dvh">
    <!-- Page Header -->
    <header class="sticky top-0 z-50 w-full border-b bg-secondary h-14">
        <div class="container flex h-14 max-w-screen-2xl items-center">
            <div>
                <strong class="uppercase"
                    ><a href="/coupons">Community</a></strong
                >
                <strong class="uppercase">///</strong>
                <strong class="uppercase"
                    ><a href="/crossover">Crossover</a></strong
                >
            </div>
            <div class="flex flex-1 items-center justify-end space-x-2">
                <Wallet></Wallet>
            </div>
        </div>
    </header>

    <!-- Slot (account for header)-->
    <main class="py-4">
        <!-- Slot -->
        <slot></slot>
    </main>

    <!-- Toaster -->
    <Toaster />
</div>

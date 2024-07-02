<script lang="ts">
    import Wallet from "$lib/components/common/Wallet.svelte";
    import { Toaster } from "$lib/components/ui/sonner";
    import { UserDeviceClient } from "$lib/userDeviceClient";
    import gsap from "gsap";
    import { onMount } from "svelte";
    import "../app.postcss";
    import { inGame, userDeviceClient } from "../store";

    let headerElement: HTMLElement;
    let headerExpanded = false;

    function toggleHeader() {
        headerExpanded = !headerExpanded;
        animateHeader($inGame, headerExpanded);
    }

    function animateHeader(inGameValue: boolean, expanded: boolean) {
        const targetWidth = !inGameValue || expanded ? "100%" : "56px";
        const targetHeight = "56px";
        const targetOpacity = expanded ? 1 : 0.3;

        gsap.to(headerElement, {
            width: targetWidth,
            height: targetHeight,
            opacity: targetOpacity,
            duration: 0.5,
            ease: "power1.inOut",
        });
    }

    async function init() {
        const client = new UserDeviceClient();
        await client.initialize();
        userDeviceClient.set(client);
    }

    onMount(() => {
        init();

        let unsubscribeGameMode = inGame.subscribe((inGameValue) => {
            headerExpanded = false;
            animateHeader(inGameValue, headerExpanded);
        });

        return () => {
            unsubscribeGameMode();
        };
    });
</script>

<!-- App Shell -->
<div class="h-dvh">
    <!-- Page Header -->
    <header
        bind:this={headerElement}
        class="top-0 left-0 z-50 bg-secondary overflow-hidden"
        class:sticky={!$inGame}
        class:fixed={$inGame}
        class:w-full={!$inGame || headerExpanded}
        class:w-14={$inGame && !headerExpanded}
        class:h-14={$inGame || !headerExpanded}
    >
        {#if $inGame && !headerExpanded}
            <button
                on:click={toggleHeader}
                class="h-14 w-14 flex items-center justify-center"
            >
                <strong class="uppercase">///</strong>
            </button>
        {:else}
            <div
                class="container flex h-14 max-w-screen-2xl items-center justify-between px-4"
            >
                <div class="flex items-center space-x-4">
                    {#if $inGame}
                        <button
                            on:click={toggleHeader}
                            class="h-10 w-10 flex items-center justify-center"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    {/if}
                    <strong class="uppercase"
                        ><a href="/coupons">Community</a></strong
                    >
                    <strong class="uppercase">///</strong>
                    <strong class="uppercase"
                        ><a href="/crossover">Crossover</a></strong
                    >
                </div>
                <div class="flex items-center space-x-2">
                    <Wallet />
                </div>
            </div>
        {/if}
    </header>

    <!-- Slot (account for header)-->
    <main class="py-0">
        <!-- Slot -->
        <slot></slot>
    </main>

    <!-- Toaster -->
    <Toaster />
</div>

<!-- 
<header
    class="sticky top-0 z-50 w-full border-b bg-secondary h-14"
    bind:this={headerElement}
>
    <div class="container flex h-14 max-w-screen-2xl items-center">
        <div>
            <strong class="uppercase"><a href="/coupons">Community</a></strong>
            <strong class="uppercase">///</strong>
            <strong class="uppercase"><a href="/crossover">Crossover</a></strong
            >
        </div>
        <div class="flex flex-1 items-center justify-end space-x-2">
            <Wallet></Wallet>
        </div>
    </div>
</header> -->

<script lang="ts">
    import Wallet from "$lib/components/common/Wallet.svelte";
    import { login, signup } from "$lib/crossover/client";
    import type { Player } from "$lib/crossover/types";
    import type { PlayerMetadata } from "$lib/crossover/world/player";
    import { worldSeed } from "$lib/crossover/world/settings/world";
    import { cn } from "$lib/shadcn";
    import { onMount } from "svelte";
    import { toast } from "svelte-sonner";
    import { inGame, token, userDeviceClient } from "../../../store";
    import Button from "../ui/button/button.svelte";
    import CharacterCreator from "./CharacterCreator.svelte";

    let requireCreateCharacter = false;
    export let onLogin: (player: Player) => void;

    const askLocation =
        "Location not found. Please enable location services and try again.";

    async function onEnterWorld() {
        const region = $userDeviceClient?.location?.country?.code;
        const geohash = $userDeviceClient?.location?.geohash;

        // Require location services
        if (!region || !geohash) {
            toast.error(askLocation, {
                action: {
                    label: "Enable location services",
                    onClick: () => {
                        $userDeviceClient?.initialize();
                    },
                },
            });
            throw new Error(askLocation);
        }

        try {
            // Try login to crossover
            const player = await login({
                region: String.fromCharCode(...region),
                geohash: String.fromCharCode(...geohash),
                retryWithRefresh: true,
            });
            onLogin(player);
        } catch (error: any) {
            // Player not created
            requireCreateCharacter = true;
        }
    }

    async function onCreateCharacter(playerMetadata: PlayerMetadata) {
        try {
            await signup(playerMetadata);
            requireCreateCharacter = false;
        } catch (error: any) {
            toast.error(error.message, {
                action: {
                    label: "Enable location services",
                    onClick: () => {
                        $userDeviceClient?.initialize();
                    },
                },
            });
        }
    }

    onMount(() => {
        // Out of game mode
        inGame.set(false);
    });
</script>

<div class={cn("flex flex-col text-center gap-4", $$restProps)}>
    {#if !$token}
        <!-- Connect wallet -->
        <h1>Login required</h1>
        <Wallet />
    {:else if !requireCreateCharacter}
        <!-- Sign up player -->
        <h1>
            {`Initiate current world seed [${worldSeed.name}]`}
        </h1>
        <Button on:click={onEnterWorld}>Enter</Button>
    {:else}
        <h1>
            {`Create your character`}
        </h1>
        <CharacterCreator
            {onCreateCharacter}
            playerPublicKey={window.solana.publicKey.toString()}
        ></CharacterCreator>
    {/if}
</div>

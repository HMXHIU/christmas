<script lang="ts">
    import { createUser } from "$lib/community";
    import Wallet from "$lib/components/common/Wallet.svelte";
    import { login, signup } from "$lib/crossover/client";
    import type { PlayerMetadata } from "$lib/crossover/world/player";
    import type { Player } from "$lib/server/crossover/redis/entities";
    import { cn } from "$lib/shadcn";
    import { onMount } from "svelte";
    import { toast } from "svelte-sonner";
    import { inGame, token, userDeviceClient } from "../../../store";
    import CharacterCreator from "./CharacterCreator.svelte";

    let requireSignup = false;
    export let onLogin: (player: Player) => void;

    const askLocation =
        "Location not found. Please enable location services and try again.";

    async function onEnterKeyPress() {
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
            const { status, player } = await login({
                region,
                geohash,
                retryWithRefresh: true,
            });
            onLogin(player);
        } catch (error) {
            // If login failed, player has not signed up
            requireSignup = true;
        }
    }

    async function onCreateCharacter(playerMetadata: PlayerMetadata) {
        try {
            // Try signup crossover player
            await signup(playerMetadata);
            requireSignup = false;
        } catch (error) {
            // Require location services
            const region = $userDeviceClient?.location?.country?.code;
            const geohash = $userDeviceClient?.location?.geohash;
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

            // Try create community user
            toast.info("Requesting permssion to create Community User.");
            await createUser({ region: String.fromCharCode(...region) });

            // Try signup crossover player
            toast.info("Requesting permssion to creating Crossover Player.");
            await signup(playerMetadata);
            requireSignup = false;

            // Login to crossover
            const { status, player } = await login({
                region,
                geohash,
                retryWithRefresh: true,
            });
            onLogin(player);
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
    {:else if !requireSignup}
        <!-- Sign up player -->
        <!-- <h1>
            {`Initiate current world seed [${worldSeed.name}]`}
        </h1>
        <Button on:click={onEnterKeyPress}>Enter</Button> -->

        <CharacterCreator {onCreateCharacter} playerPublicKey="player"
        ></CharacterCreator>
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

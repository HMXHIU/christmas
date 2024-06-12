<script lang="ts">
    import { createUser } from "$lib/community";
    import Wallet from "$lib/components/common/Wallet.svelte";
    import { Button } from "$lib/components/ui/button";
    import { login, signup } from "$lib/crossover";
    import type { PlayerMetadata } from "$lib/crossover/world/player";
    import { worldSeed } from "$lib/crossover/world/settings";
    import { cn } from "$lib/shadcn";
    import { toast } from "svelte-sonner";
    import { token, userDeviceClient } from "../../../store";
    import CharacterCreator from "./CharacterCreator.svelte";

    let requireSignup = false;

    async function onEnter() {
        const region = $userDeviceClient?.location?.country?.code;
        const geohash = $userDeviceClient?.location?.geohash;

        // Require location services
        if (!region || !geohash) {
            const err =
                "Location not found. Please enable location services and try again.";
            toast.error(err, {
                action: {
                    label: "Enable location services",
                    onClick: () => {
                        $userDeviceClient?.initialize();
                    },
                },
            });
            throw new Error(err);
        }

        try {
            // Try login to crossover
            await login({ region, geohash, retryWithRefresh: true });
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
                const err =
                    "Location not found. Please enable location services and try again.";
                toast.error(err, {
                    action: {
                        label: "Enable location services",
                        onClick: () => {
                            $userDeviceClient?.initialize();
                        },
                    },
                });
                throw new Error(err);
            }

            // Try create community user
            toast.info("Requesting permssion to create Community User.");
            await createUser({ region: String.fromCharCode(...region) });

            // Try signup crossover player
            toast.info("Requesting permssion to creating Crossover Player.");
            await signup(playerMetadata);
            requireSignup = false;

            // Login to crossover
            await login({ region, geohash, retryWithRefresh: true });
        }
    }
</script>

<div class={cn("flex flex-col text-center gap-4", $$restProps)}>
    {#if !$token}
        <!-- Connect wallet -->
        <h1>Login required</h1>
        <Wallet />
    {:else if !requireSignup}
        <!-- Sign up player -->
        <h1>
            {`Initiate current world seed [${worldSeed.name}]`}
        </h1>
        <Button on:click={onEnter}>Enter</Button>
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

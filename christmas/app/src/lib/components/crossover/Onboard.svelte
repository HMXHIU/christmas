<script lang="ts">
    import { createUser } from "$lib/community";
    import Wallet from "$lib/components/common/Wallet.svelte";
    import { Button } from "$lib/components/ui/button";
    import { login, signup } from "$lib/crossover";
    import type { PlayerMetadataSchema } from "$lib/crossover/world/player";
    import { worldSeed } from "$lib/crossover/world/settings";
    import { cn } from "$lib/shadcn";
    import { toast } from "svelte-sonner";
    import { z } from "zod";
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

    async function onCreateCharacter(
        playerMetadata: z.infer<typeof PlayerMetadataSchema>,
    ) {
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

<div
    class={cn(
        "container flex justify-center items-center h-full overflow-y-auto",
        $$restProps,
    )}
>
    <div class="flex flex-col mx-auto text-center gap-4">
        {#if !$token}
            <!-- Connect wallet -->
            <p>Login required</p>
            <Wallet />
        {:else if window.solana?.publicKey == null}
            <p>Check that you have downloaded the phantom wallet</p>
        {:else if !requireSignup}
            <!-- Sign up player -->
            <p>
                {`Initiate current world seed [${worldSeed.name}]`}
            </p>
            <Button on:click={onEnter}>Enter</Button>
        {:else}
            <p>
                {`Player undetected, digitizing ${window.solana.publicKey.toString()} ...`}
            </p>
            <CharacterCreator
                {onCreateCharacter}
                playerPublicKey={window.solana.publicKey.toString()}
            ></CharacterCreator>
        {/if}
    </div>
</div>

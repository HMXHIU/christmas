<script lang="ts">
    import { createUser } from "$lib/community";
    import { Button } from "$lib/components/ui/button";
    import { login, signup, worldSeed } from "$lib/crossover";
    import { player, token, userDeviceClient } from "../../../store";
    import { toast } from "svelte-sonner";
    import Wallet from "$lib/components/common/Wallet.svelte";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Label } from "$lib/components/ui/label";
    import { Input } from "$lib/components/ui/input";
    import {
        PlayerMetadataSchema,
        type PlayerMetadata,
    } from "$lib/crossover/types";

    let requireSignup = false;

    let name: string = "";
    let description: string = "";

    let errors: { name?: string; description?: string } = {};

    async function onEnter() {
        try {
            // Try login to crossover
            await login();
        } catch (error) {
            // If login failed, player has not signed up
            requireSignup = true;
        }
    }

    async function onCreateCharacter() {
        try {
            // Validate player metadata
            let playerMetadata: PlayerMetadata | null = null;
            try {
                playerMetadata = await PlayerMetadataSchema.validate(
                    {
                        name,
                        description,
                        player: window.solana.publicKey.toString(),
                    },
                    { abortEarly: false }, // `abortEarly: false` to get all the errors
                );
            } catch (err) {
                errors = extractErrors(err);
            }
            // Try signup crossover player
            if (playerMetadata) {
                await signup(playerMetadata);
                requireSignup = false;
            }
        } catch (error) {
            // If signup failed, user has not been created
            if (!$userDeviceClient?.location?.country?.code) {
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
            // Create community user
            toast.info("Requesting permssion to create Community User.");
            await createUser({
                region: String.fromCharCode(
                    ...$userDeviceClient?.location?.country?.code!,
                ),
            });
            // Signup crossover player
            toast.info("Requesting permssion to creating Crossover Player.");
            await signup({ name: "Player" });

            // Login to crossover
            await login();
        }
    }

    function extractErrors(err: any) {
        return err.inner.reduce((acc: any, err: any) => {
            return { ...acc, [err.path]: err.message };
        }, {});
    }
</script>

<div class="container flex flex-col h-full w-full">
    <div class="flex flex-col mx-auto my-auto text-center gap-4">
        {#if !$token}
            <!-- Connect wallet -->
            <p>Login required</p>
            <Wallet />
        {:else if !requireSignup}
            <!-- Sign up player -->
            <p>{`Initiate current world seed [${worldSeed}]`}</p>
            <Button on:click={onEnter}>Enter</Button>
        {:else}
            <p>
                {`Player undetected, digitizing ${window.solana.publicKey.toString()} ...`}
            </p>
            <!-- Player name -->
            <div class="grid w-full gap-2">
                <Label for="player-name">Character Name</Label>
                <Input
                    id="player-name"
                    type="text"
                    bind:value={name}
                    maxlength={100}
                    placeholder="What is your character called"
                />
                {#if errors.name}
                    <p class="text-xs text-destructive">{errors.name}</p>
                {/if}
            </div>
            <!-- Player description -->
            <div class="grid w-full gap-2">
                <Label for="player-desc">Character Description</Label>
                <Textarea
                    placeholder="How does your character look like?"
                    id="player-desc"
                    rows={4}
                    maxlength={400}
                    bind:value={description}
                />
                {#if errors.description}
                    <p class="text-xs text-destructive">
                        {errors.description}
                    </p>
                {/if}
            </div>
            <Button on:click={onCreateCharacter}>Create Character</Button>
        {/if}
    </div>
</div>

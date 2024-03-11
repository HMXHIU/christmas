<script lang="ts">
    import { createUser } from "$lib/community";
    import Wallet from "$lib/components/common/Wallet.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Textarea } from "$lib/components/ui/textarea";
    import { login, signup } from "$lib/crossover";
    import { worldSeed } from "$lib/crossover/world";
    import { parseZodErrors } from "$lib/utils";
    import { toast } from "svelte-sonner";
    import { z } from "zod";
    import { token, userDeviceClient } from "../../../store";

    const PlayerMetadataSchema = z.object({
        player: z.string(),
        name: z.string().min(1).max(100),
        description: z.string().max(400).optional(),
    });

    let requireSignup = false;

    let name: string = "";
    let description: string = "";

    let errors: Record<string, string> = {};

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
            await login({ region, geohash });
        } catch (error) {
            // If login failed, player has not signed up
            requireSignup = true;
        }
    }

    async function onCreateCharacter() {
        try {
            // Validate player metadata
            let playerMetadata: z.infer<typeof PlayerMetadataSchema> | null =
                null;
            try {
                playerMetadata = await PlayerMetadataSchema.parse({
                    name,
                    description,
                    player: window.solana.publicKey.toString(),
                });
            } catch (err) {
                errors = parseZodErrors(err);
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
            await login({ region, geohash });
        }
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
            <p>{`Initiate current world seed [${worldSeed.name}]`}</p>
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

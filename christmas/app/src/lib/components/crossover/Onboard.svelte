<script lang="ts">
    import { createUser } from "$lib/community";
    import Wallet from "$lib/components/common/Wallet.svelte";
    import { Button } from "$lib/components/ui/button";
    import * as Card from "$lib/components/ui/card/index.js";
    import { Input } from "$lib/components/ui/input";
    import * as Select from "$lib/components/ui/select/index.js";
    import { Textarea } from "$lib/components/ui/textarea";
    import { login, signup } from "$lib/crossover";
    import {
        AGE_TYPES,
        ARCHETYPE_TYPES,
        BODY_TYPES,
        EYE_COLORS,
        EYE_TYPES,
        FACE_TYPES,
        GENDER_TYPES,
        HAIR_COLORS,
        HAIR_TYPES,
        PERSONALITY_TYPES,
        SKIN_TYPES,
        ageTypes,
        archetypeTypes,
        bodyTypes,
        eyeColors,
        eyeTypes,
        faceTypes,
        genderTypes,
        hairColors,
        hairTypes,
        personalityTypes,
        playerStats,
        raceTypes,
        skinTypes,
    } from "$lib/crossover/world/player";
    import { worldSeed } from "$lib/crossover/world/settings";
    import { parseZodErrors } from "$lib/utils";
    import { toast } from "svelte-sonner";
    import { z } from "zod";
    import { player, token, userDeviceClient } from "../../../store";
    import LabelField from "../common/LabelField.svelte";
    import SeparatorWithText from "../common/SeparatorWithText.svelte";

    const PlayerMetadataSchema = z.object({
        player: z.string(),
        name: z.string().min(1).max(100),
        description: z.string().max(400).optional(),
        gender: z.enum(GENDER_TYPES),
        archetype: z.enum(ARCHETYPE_TYPES),
        attributes: z.object({
            str: z.number(),
            dex: z.number(),
            con: z.number(),
            int: z.number(),
            wis: z.number(),
            cha: z.number(),
        }),
        appearance: z.object({
            hair: z.object({
                type: z.enum(HAIR_TYPES),
                color: z.enum(HAIR_COLORS),
            }),
            eye: z.object({
                type: z.enum(EYE_TYPES),
                color: z.enum(EYE_COLORS),
            }),
            face: z.enum(FACE_TYPES),
            body: z.enum(BODY_TYPES),
            skin: z.enum(SKIN_TYPES),
            personality: z.enum(PERSONALITY_TYPES),
            age: z.enum(AGE_TYPES),
        }),
    });

    let requireSignup = false;

    let name: string = "";
    let description: string = "";
    let selectedHairType = hairTypes[0];
    let selectedHairColor = hairColors[0];
    let selectedEyeColor = eyeColors[0];
    let selectedEyeType = eyeTypes[0];
    let selectedFaceType = faceTypes[0];
    let selectedBodyType = bodyTypes[0];
    let selectedSkinType = skinTypes[0];
    let selectedAgeType = ageTypes[0];
    let selectedPersonalityType = personalityTypes[0];
    let selectedRaceType = raceTypes[0];
    let selectedGenderType = genderTypes[0];
    let selectedArchetypeType = archetypeTypes[0];
    let archetypes = archetypeTypes.reduce(
        (acc: Record<string, typeof cur>, cur) => {
            acc[cur.value] = cur;
            return acc;
        },
        {},
    );

    $: attributes = archetypes[selectedArchetypeType.value].attributes;
    $: stats = playerStats({
        level: 1,
        attributes: attributes,
    });

    console.log(archetypes);

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
            await login({ region, geohash, retryWithRefresh: true });
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
            await login({ region, geohash, retryWithRefresh: true });
        }
    }
</script>

<div class="container flex flex-col h-full w-full">
    <div class="flex flex-col mx-auto my-auto text-center gap-4">
        {#if !$token}
            <!-- Connect wallet -->
            <p>Login required</p>
            <Wallet />
            <!-- {:else if !requireSignup} -->
        {:else if false}
            <!-- Sign up player -->
            <p>{`Initiate current world seed [${worldSeed.name}]`}</p>
            <Button on:click={onEnter}>Enter</Button>
        {:else}
            <p>
                {`Player undetected, digitizing ${window.solana.publicKey?.toString()} ...`}
            </p>

            <!-- Character -->
            <Card.Root>
                <Card.Header>
                    <Card.Title>Character</Card.Title>
                </Card.Header>
                <Card.Content>
                    <div class="grid grid-cols-2 gap-4">
                        <!-- Name -->
                        <LabelField label="Name" class="text-left">
                            <Input
                                id="player-name"
                                type="text"
                                bind:value={name}
                                maxlength={100}
                                placeholder="Your character's name"
                            />
                            {#if errors.name}
                                <p class="text-xs text-destructive">
                                    {errors.name}
                                </p>
                            {/if}
                        </LabelField>
                        <!-- Race -->
                        <LabelField label="Race" class="text-left">
                            <Select.Root bind:selected={selectedRaceType}>
                                <Select.Trigger>
                                    <Select.Value placeholder="" />
                                </Select.Trigger>
                                <Select.Content>
                                    <Select.Group>
                                        {#each raceTypes as raceType}
                                            <Select.Item
                                                value={raceType.value}
                                                label={raceType.label}
                                                >{raceType.label}</Select.Item
                                            >
                                        {/each}
                                    </Select.Group>
                                </Select.Content>
                                <Select.Input name="raceType" />
                            </Select.Root>
                        </LabelField>
                        <!-- Gender -->
                        <LabelField label="Gender" class="text-left">
                            <Select.Root bind:selected={selectedGenderType}>
                                <Select.Trigger>
                                    <Select.Value placeholder="" />
                                </Select.Trigger>
                                <Select.Content>
                                    <Select.Group>
                                        {#each genderTypes as genderType}
                                            <Select.Item
                                                value={genderType.value}
                                                label={genderType.label}
                                                >{genderType.label}</Select.Item
                                            >
                                        {/each}
                                    </Select.Group>
                                </Select.Content>
                                <Select.Input name="genderType" />
                            </Select.Root>
                        </LabelField>
                        <!-- Archetype -->
                        <LabelField label="Archetype" class="text-left">
                            <Select.Root bind:selected={selectedArchetypeType}>
                                <Select.Trigger>
                                    <Select.Value placeholder="" />
                                </Select.Trigger>
                                <Select.Content>
                                    <Select.Group>
                                        {#each archetypeTypes as archetypeType}
                                            <Select.Item
                                                value={archetypeType.value}
                                                label={archetypeType.label}
                                                >{archetypeType.label}</Select.Item
                                            >
                                        {/each}
                                    </Select.Group>
                                </Select.Content>
                                <Select.Input name="archetypeType" />
                            </Select.Root>
                        </LabelField>
                        <!-- Description -->
                        <LabelField label="Description" class="text-left">
                            <Textarea
                                placeholder="Describe your character's backstory and origin."
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
                        </LabelField>
                    </div>
                </Card.Content>
            </Card.Root>

            <!-- Abilities -->
            <Card.Root>
                <Card.Header>
                    <Card.Title>Abilities</Card.Title>
                </Card.Header>
                <Card.Content>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="grid gap-2">
                            <SeparatorWithText>Attributes</SeparatorWithText>
                            <div class="p-2">
                                <p class="text-xs">
                                    <span class="font-bold">Strength:</span>
                                    {attributes.str}
                                </p>
                                <p class="text-xs">
                                    <span class="font-bold">Dexterity:</span>
                                    {attributes.dex}
                                </p>
                                <p class="text-xs">
                                    <span class="font-bold">Constitution:</span>
                                    {attributes.con}
                                </p>
                                <p class="text-xs">
                                    <span class="font-bold">Intelligence:</span>
                                    {attributes.int}
                                </p>
                                <p class="text-xs">
                                    <span class="font-bold">Wisdom:</span>
                                    {attributes.wis}
                                </p>
                                <p class="text-xs">
                                    <span class="font-bold">Charisma:</span>
                                    {attributes.cha}
                                </p>
                            </div>
                        </div>
                        <div>
                            <SeparatorWithText>Stats</SeparatorWithText>
                            <div class="p-2">
                                <p class="text-xs">
                                    <span class="font-bold">Level:</span>
                                    {$player?.level ?? 1}
                                </p>
                                <p class="text-xs">
                                    <span class="font-bold">Health:</span>
                                    {stats.hp}
                                </p>
                                <p class="text-xs">
                                    <span class="font-bold">Mana:</span>
                                    {stats.mp}
                                </p>
                                <p class="text-xs">
                                    <span class="font-bold">Stamina:</span>
                                    {stats.st}
                                </p>
                            </div>
                        </div>
                    </div>
                </Card.Content>
            </Card.Root>

            <!-- Appearance -->
            <Card.Root>
                <Card.Header>
                    <Card.Title>Appearance</Card.Title>
                </Card.Header>
                <Card.Content>
                    <div class="grid grid-cols-2 gap-4">
                        <!-- Face -->
                        <div>
                            <SeparatorWithText>Face</SeparatorWithText>
                            <!-- Face Type -->
                            <LabelField label="Face Type" class="p-2 text-left">
                                <Select.Root bind:selected={selectedFaceType}>
                                    <Select.Trigger>
                                        <Select.Value placeholder="" />
                                    </Select.Trigger>
                                    <Select.Content>
                                        <Select.Group>
                                            {#each faceTypes as faceType}
                                                <Select.Item
                                                    value={faceType.value}
                                                    label={faceType.label}
                                                    >{faceType.label}</Select.Item
                                                >
                                            {/each}
                                        </Select.Group>
                                    </Select.Content>
                                    <Select.Input name="faceType" />
                                </Select.Root>
                            </LabelField>
                            <!-- Eye Type -->
                            <LabelField label="Eye Type" class="p-2 text-left">
                                <Select.Root bind:selected={selectedEyeType}>
                                    <Select.Trigger>
                                        <Select.Value placeholder="" />
                                    </Select.Trigger>
                                    <Select.Content>
                                        <Select.Group>
                                            {#each eyeTypes as eyeType}
                                                <Select.Item
                                                    value={eyeType.value}
                                                    label={eyeType.label}
                                                    >{eyeType.label}</Select.Item
                                                >
                                            {/each}
                                        </Select.Group>
                                    </Select.Content>
                                    <Select.Input name="eyeType" />
                                </Select.Root>
                            </LabelField>
                            <!-- Eye Color -->
                            <LabelField label="Eye Color" class="p-2 text-left">
                                <Select.Root bind:selected={selectedEyeColor}>
                                    <Select.Trigger>
                                        <Select.Value placeholder="" />
                                    </Select.Trigger>
                                    <Select.Content>
                                        <Select.Group>
                                            {#each eyeColors as eyeColor}
                                                <Select.Item
                                                    value={eyeColor.value}
                                                    label={eyeColor.label}
                                                    >{eyeColor.label}</Select.Item
                                                >
                                            {/each}
                                        </Select.Group>
                                    </Select.Content>
                                    <Select.Input name="eyeColor" />
                                </Select.Root>
                            </LabelField>
                        </div>
                        <!-- Hair -->
                        <div>
                            <SeparatorWithText>Hair</SeparatorWithText>
                            <!-- Hair Type -->
                            <LabelField
                                label="Hair Style"
                                class="p-2 text-left"
                            >
                                <Select.Root bind:selected={selectedHairType}>
                                    <Select.Trigger>
                                        <Select.Value placeholder="" />
                                    </Select.Trigger>
                                    <Select.Content>
                                        <Select.Group>
                                            {#each hairTypes as hairType}
                                                <Select.Item
                                                    value={hairType.value}
                                                    label={hairType.label}
                                                    >{hairType.label}</Select.Item
                                                >
                                            {/each}
                                        </Select.Group>
                                    </Select.Content>
                                    <Select.Input name="hairType" />
                                </Select.Root>
                            </LabelField>
                            <!-- Hair Color -->
                            <LabelField
                                label="Hair Color"
                                class="p-2 text-left"
                            >
                                <Select.Root bind:selected={selectedHairColor}>
                                    <Select.Trigger>
                                        <Select.Value placeholder="" />
                                    </Select.Trigger>
                                    <Select.Content>
                                        <Select.Group>
                                            {#each hairColors as hairColor}
                                                <Select.Item
                                                    value={hairColor.value}
                                                    label={hairColor.label}
                                                    >{hairColor.label}</Select.Item
                                                >
                                            {/each}
                                        </Select.Group>
                                    </Select.Content>
                                    <Select.Input name="hairColor" />
                                </Select.Root>
                            </LabelField>
                        </div>
                        <!-- Body -->
                        <div>
                            <SeparatorWithText>Body</SeparatorWithText>
                            <!-- Body Type -->
                            <LabelField label="Body Type" class="p-2 text-left">
                                <Select.Root bind:selected={selectedBodyType}>
                                    <Select.Trigger>
                                        <Select.Value placeholder="" />
                                    </Select.Trigger>
                                    <Select.Content>
                                        <Select.Group>
                                            {#each bodyTypes as bodyType}
                                                <Select.Item
                                                    value={bodyType.value}
                                                    label={bodyType.label}
                                                    >{bodyType.label}</Select.Item
                                                >
                                            {/each}
                                        </Select.Group>
                                    </Select.Content>
                                    <Select.Input name="bodyType" />
                                </Select.Root>
                            </LabelField>
                            <!-- Skin Type -->
                            <LabelField label="Skin Type" class="p-2 text-left">
                                <Select.Root bind:selected={selectedSkinType}>
                                    <Select.Trigger>
                                        <Select.Value placeholder="" />
                                    </Select.Trigger>
                                    <Select.Content>
                                        <Select.Group>
                                            {#each skinTypes as skinType}
                                                <Select.Item
                                                    value={skinType.value}
                                                    label={skinType.label}
                                                    >{skinType.label}</Select.Item
                                                >
                                            {/each}
                                        </Select.Group>
                                    </Select.Content>
                                    <Select.Input name="skinType" />
                                </Select.Root>
                            </LabelField>
                        </div>
                        <!-- Personality -->
                        <div>
                            <SeparatorWithText>Personality</SeparatorWithText>
                            <!-- Age Type -->
                            <LabelField label="Age" class="p-2 text-left">
                                <Select.Root bind:selected={selectedAgeType}>
                                    <Select.Trigger>
                                        <Select.Value placeholder="" />
                                    </Select.Trigger>
                                    <Select.Content>
                                        <Select.Group>
                                            {#each ageTypes as ageType}
                                                <Select.Item
                                                    value={ageType.value}
                                                    label={ageType.label}
                                                    >{ageType.label}</Select.Item
                                                >
                                            {/each}
                                        </Select.Group>
                                    </Select.Content>
                                    <Select.Input name="ageType" />
                                </Select.Root>
                            </LabelField>
                            <!-- Personality Type -->
                            <LabelField
                                label="Personality"
                                class="p-2 text-left"
                            >
                                <Select.Root
                                    bind:selected={selectedPersonalityType}
                                >
                                    <Select.Trigger>
                                        <Select.Value placeholder="" />
                                    </Select.Trigger>
                                    <Select.Content>
                                        <Select.Group>
                                            {#each personalityTypes as personalityType}
                                                <Select.Item
                                                    value={personalityType.value}
                                                    label={personalityType.label}
                                                    >{personalityType.label}</Select.Item
                                                >
                                            {/each}
                                        </Select.Group>
                                    </Select.Content>
                                    <Select.Input name="personalityType" />
                                </Select.Root>
                            </LabelField>
                        </div>
                    </div>
                </Card.Content>
            </Card.Root>

            <Button on:click={onCreateCharacter}>Create Character</Button>
        {/if}
    </div>
</div>

# Character Creation

## Happy Path

1. User has not created a character yet, redirected to character creation page
2. User fills out the character creation form (hair color, eye color, class, race, etc.)
3. At the end of the chracter creation form is an avatar selection screen
   - If there are pregenerated characters, user can select one of those instead
   - Else there will be a button for user to generate a random character (using avatar API)
4. User submits the `PlayerMetadata` as well as the avatar selection
5. The backend verifies that the `PlayerMetadata` matches the avatar selection
   - If it is verified, the backend updates the `PlayerMetadata` in MINIO with the avatar selection

## Avatar Naming Convention

```js
const playerMetadata = await PlayerMetadataSchema.parse({
  name,
  description,
  player: playerPublicKey,
  gender: selectedGenderType.value,
  race: selectedRaceType.value,
  archetype: selectedArchetypeType.value,
  attributes: archetypes[selectedArchetypeType.value].attributes,
  appearance: {
    hair: {
      type: selectedHairType.value,
      color: selectedHairColor.value,
    },
    eye: {
      type: selectedEyeType.value,
      color: selectedEyeColor.value,
    },
    face: selectedFaceType.value,
    body: selectedBodyType.value,
    skin: selectedSkinType.value,
    personality: selectedPersonalityType.value,
    age: selectedAgeType.value,
  },
});

// Hash the player invariant metadata (exclude the `name`, `description` and `attributes`)
const avatarHash = await sha256(
  JSON.stringify(playerMetadata.pop("name", "description", "attributes"))
);

// Generate a random seed for use in stable diffusion
function generateRandomSeed() {
  // Define the range for the seed, e.g., 0 to 2^32 - 1
  const maxSeed = Math.pow(2, 32) - 1;
  // Generate a random integer within the range
  const randomSeed = Math.floor(Math.random() * maxSeed);
  return randomSeed;
}

const fileName = `${avatarHash}-${generateRandomSeed()}.png`;
```

Store the avatar in a flat folder in MINIO for pregenerated avatars

```sh
minio/
  avatar/
    xxxxx_000000.png
    yyyyy_111111.png
    zzzzz_222222.png
    ...
```

This way we can easily retrieve the avatars by searching for the `avatarHash` in the filename (startswith/prefix)

## Creating/Selecting an Avatar

1. If there are pregenerated avatars, show 3 random avatars for the user
2. If there are no pregenerated avatars, show a button for the user to generate a random avatar
3. Generate 2 characters using the avatar API
4. Allow the user to select one of the 2 characters
5. The unselected character is stored for other users to select

## Keeping track of picked avatars

When a player selects an avatar, the avatar is renamed by appending the player's public key to the front of the filename

- This preserves the seed if the avatar needs to be recreated/modifed in the future
- When the user changes their metadata (class change, equipment change, etc.), a new avatar can be created with the same seed, but different `avatarHash`. Thus the old avatar is not deleted (allows the user to revert back to the old avatar)

```js
// Append the player's public key to the front of the filename
const fileName = `${publicKey}-xxxxx-00000.png`;

// When the player changes their metadata, create a new avatar with the same seed & public key
const newAvatarHash = await sha256(
  JSON.stringify(newPlayerMetadata.pop("name", "description", "attributes"))
);
const newFileName = `ppppppppp-${newAvatarHash}-00000.png`;
```

## Questions

1. Should the player avatar be an NFT? Or should it be stored in MINIO in `PlayerMetadata`?
   _Cons_: gas fees, minting fees, etc.
   **Answer**: For now, store in `PlayerMetadata` in MINIO

2. Should the player avatar be uploaded to IPFS?
   _Pros_: free hosting, decentralized, backup
   _Cons_: IPFS is slow, not always reliable
   **Answer**: For now, store in MINIO

3. Should the player be allowed to choose an avatar already chosen by another player?
   **Answer**: No, the avatar should be unique to the player

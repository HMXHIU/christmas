# Introduction

# Character Creation

Character creation involves:

1. Select appearance parameters (hair, face, age ...)

- [ ] Need to reduce the number parameters to five else there is too many to generate.
- [ ] Generate 5*3*4*5*2 = 600 (gender(2), hair(5), race(4), age(3), face(5)) number of premade portraits
- [ ] Write a script to autogenerate all of these combinations
- [ ] Use a controlnet to draw the portrait with the armour, then remove the armour (this is so that the back of an long hair is not drawn)
- [ ] Handle eye color seperately via tinting (could include anatomical segmentation map in the alpha channel in the normal map)
- [ ] Store apperance parameters in `PlayerMetadata` in MINIO

2. Select demographic parameters (race, gender, and archetype, ...)

- [ ] Store demographic parameters in `PlayerMetadata` in MINIO
- [ ] Copy demographic parameters in `PlayerEntity` in Redis, because they are used to determine/check stats and other effects
- [ ] Demographic parameters determine starting attributes (wisdom, strength, constitution, etc ...)

3. Generating the player portrait

- [ ] Pregenerate many different portraits based using appearance parameters - randomly assign user to one of them based on appearance selectors
- [ ] Allow user to upload their own photo and use stable diffusion to generate a custom image (paid only)
- [ ] Portraits should be generated in 2 profiles (front and side)
- [ ] Portrait should scaled down to 96x96 so that it is reasonable to be used in the Avatar as well as in character sheet

# Portrait

- [ ] Facial segmentation map can achieve different colors for skin color, hair color, eye color
- [ ] Generate normal map

# Equipment & Avatar

- [ ] Individual equipment should be generated at approximately 96x96 or lesser resolution
- [x] Armour equipment slots (chest, legs, gloves, boots, helmet) - affects the look of the avatar
- [x] Armour should support layers (i.e. equipment should be drawn over default skin texture, legs and boots may have textures for lower legs, in this case, legs should draw first, then boots) - this means `Bones` should support multiple `IsoMeshes`
- [x] Add tint to default texture (this serves as underarmour)
- [x] Setting to let equipment overlay or replace
- [ ] Do not support drawing helmets (no texture) for now as it is hard to draw over the face with the hair
- [ ] Weapon equipment slots (right hand, left hand) - affects the look of the avatar
- [ ] Shields are always displayed on the front hand, weapons can be on both, but defaults to front hand if only single.
- [x] Equipment such as armour and weapons are considered `items` with `props` in the `compendium`
- [x] Avatar morphology JSON contains default textures (bare skin only) when no equipment is equipped
- [x] Armour equipment such as armour, boots and gloves have multiple textures with fixed names (eg. back_lower_arm.png, front_lower_arm.png, ...). When equipped, call `Bone.setTexture` to replace the default texture for the bone
  ```json
  "textures": {
    "torso": "http://localhost:5173/avatar/images/female_default/torso.png",
    "head": "http://localhost:5173/avatar/images/female_default/head.png",
    "front_upper_arm": "http://localhost:5173/avatar/images/female_default/front_upper_arm.png",
    "front_lower_arm": "http://localhost:5173/avatar/images/female_default/front_lower_arm.png",
    "back_upper_arm": "http://localhost:5173/avatar/images/female_default/back_upper_arm.png",
    "back_lower_arm": "http://localhost:5173/avatar/images/female_default/back_lower_arm.png",
    "front_upper_leg": "http://localhost:5173/avatar/images/female_default/front_upper_leg.png",
    "front_lower_leg": "http://localhost:5173/avatar/images/female_default/front_lower_leg.png",
    "back_upper_leg": "http://localhost:5173/avatar/images/female_default/back_upper_leg.png",
    "back_lower_leg": "http://localhost:5173/avatar/images/female_default/back_lower_leg.png"
  }
  ```
- [ ] Add bones for right hand, left hand weapon (without texture, similar to pivotBone). Call `Bone.setTexture` in rh and lh bones when weapons are equipped

# Equipment props

- [ ] Equipment item props can be either from the compendium (standard) or from NFTs
- [ ] If from NFT the prop should be the public address of the NFT
- [ ] The NFT data should be loaded into Redis with the corresponding API to access them
- [ ] Add additional fields for stats etc ...

```ts
interface Prop {
  prop: string;
  defaultName: string;
  defaultState: string;
  asset: AssetMetadata;
  durability: number;
  charges: number;
  states: Record<string, PropAttributes>; // map item.state to prop attributes
  utilities: Record<string, Utility>;
  variables: PropVariables; // configurable variables to alter prop behavior & descriptions
  equipmentSlot?: EquipmentSlot[];
  weight: number; // -1 means it cannot be taken
  collider: boolean; // cannot have more than 1 collidable item in the same location, cannot walk through collidable items
}
```

## Character Creation Happy Path

1. User has not created a character yet, redirected to character creation page
2. User fills out the character creation form (demographics, appearance etc.)
3. At the end of the chracter creation form is a portrait selection screen
   - Choose a randomly selected pre-generated portrait
   - Upload photo to generate a random portrait (using avatar API) - PAID option
4. User submits the `PlayerMetadata` as well as the portrait selection
5. The backend verifies that the `PlayerMetadata` matches the portrait selection
   - If it is verified, the backend updates the `PlayerMetadata` in MINIO with the portrait selection

## Portrait Naming Convention

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
    hair: selectedHairType.value,
    face: selectedFaceType.value,
    age: selectedAgeType.value,
  },
});

// Hash the player invariant metadata (exclude the `name`, `description` and `attributes`)
const portraitHash = await sha256(
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

const fileName = `${portraitHash}-${generateRandomSeed()}.png`;
```

Store the portraits in a flat folder in MINIO for pregenerated portraits

```sh
minio/
  portraits/
    xxxxx_000000.png
    yyyyy_111111.png
    zzzzz_222222.png
    ...
```

This way we can easily retrieve the portraits by searching for the `portraitHash` in the filename (startswith/prefix)

## Creating/Selecting an Portrait

1. If there are pregenerated portraits, show 3 random portraits for the user
2. If there are no pregenerated portraits, show 3 generic portraits for the user
3. If user uploads his photo:

- Upload his photo for style transfer
- Generate 2 characters using the avatar API
- Allow the user to select one of the 2 characters

## Keeping track of picked portraits

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
   **Answer**: Yes, most are pregenerated. No, if user uploads his own photo

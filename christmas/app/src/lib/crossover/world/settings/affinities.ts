import type { Affinity } from "../affinities";

export { factions, type Faction };

type Faction = "historian" | "meatshield" | "arachnid" | "fae" | "serpent";

/*
Faction affinity is not the same as the player's affinity (it is a general alignment, not a hard alignment).
Factions represent organizations in the world in which player's or monsters are a part of.
Factions do not represent races, though races have stereotypical factions.
Factions are mutable (mostly).
There maybe be goblin slaves inside a human faction, or evil humans who take part in a generally good/neutral faction.

The faction affinity is used for determining hostility between monsters/npcs and players.
*/

const factions: Record<
    Faction,
    { affinity: Affinity; description: string; name: string; faction: Faction }
> = {
    // Human factions
    historian: {
        faction: "historian",
        name: "The Guild of the Historians",
        description: `Dedicated to the preservation of knowledge,
history, and ancient artifacts, safeguards the legacy of past ages and ensures the wisdom of the past is never forgotten.`,
        affinity: {
            moral: "good",
            ethic: "balanced",
            aesthetic: "mundane",
            being: "mortal",
        },
    },
    // Monster factions
    meatshield: {
        faction: "meatshield",
        name: "The Meatshield Society",
        description: `Orcs, goblins, and ogres who proudly stand in the way of danger (because they haven’t learned to dodge).`,
        affinity: {
            moral: "evil",
            ethic: "chaotic",
            aesthetic: "grotesque",
            being: "mortal",
        },
    },
    arachnid: {
        faction: "arachnid",
        name: "Arachnid",
        description: "",
        affinity: {
            moral: "neutral",
            ethic: "chaotic",
            aesthetic: "grotesque",
            being: "mortal",
        },
    },
    fae: {
        faction: "fae",
        name: "Fae",
        description: "",
        affinity: {
            moral: "neutral",
            ethic: "balanced",
            aesthetic: "elegant",
            being: "fae",
        },
    },
    serpent: {
        faction: "serpent",
        name: "Serpent",
        description: "",
        affinity: {
            moral: "neutral",
            ethic: "chaotic",
            aesthetic: "elegant",
            being: "cosmic",
        },
    },
};

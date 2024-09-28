import { seededRandom, stringToRandomNumber } from "$lib/utils";
import type { BiomeParameters, BiomeType } from "../world/biomes";
import type { BiomeDescriptors } from "./settings";

export { describeBiome };

function describeBiome(
    city: string,
    biomeParameters: BiomeParameters,
    elevation: number,
    settings: BiomeDescriptors,
): string {
    const {
        biomeDescriptors,
        elevationDescriptors,
        timeDescriptors,
        biomeMixDescriptions,
        defaultMixDescription,
        secondaryBiomeThreshold,
    } = settings;

    // Sort biomes by probability
    const sortedBiomes = Object.entries(biomeParameters)
        .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
        .filter(([, prob]) => prob && prob > 0);

    if (sortedBiomes.length === 0) {
        return "The land here defies description, a mystery even to the wisest.";
    }

    const rv = seededRandom(stringToRandomNumber(city));

    const primaryBiome = sortedBiomes[0][0] as BiomeType;
    const secondaryBiome = sortedBiomes[1]?.[0] as BiomeType | undefined;

    const getRandomDescriptor = (biome: BiomeType) =>
        biomeDescriptors[biome][
            Math.floor(rv * biomeDescriptors[biome].length)
        ];

    let description =
        elevationDescriptors[
            Math.min(
                Math.floor(elevation / 1000),
                elevationDescriptors.length - 1,
            )
        ];

    description += getRandomDescriptor(primaryBiome) + ". ";

    if (
        secondaryBiome &&
        biomeParameters[secondaryBiome]! > secondaryBiomeThreshold
    ) {
        description += "Yet, ";
        const mixDescription = biomeMixDescriptions.find((mix) =>
            mix.condition(primaryBiome, secondaryBiome),
        );
        if (mixDescription) {
            description += mixDescription.description;
        } else {
            description +=
                getRandomDescriptor(secondaryBiome) + defaultMixDescription;
        }
    }

    description += timeDescriptors[Math.floor(rv * timeDescriptors.length)];

    return description;
}

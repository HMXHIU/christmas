import {
    sampleFrom,
    seededRandomNumberBetween,
    stringToRandomNumber,
} from "$lib/utils/random";
import { childrenGeohashesAtPrecision } from "../../utils";
import { worldSeed } from "../settings/world";
import type { GeohashLocation } from "../types";
import type { BluePrint, Stencil } from "./types";

export { sampleChildrenGeohashesAtPrecision, stencilFromBlueprint };

function sampleChildrenGeohashesAtPrecision(
    location: string,
    precision: number,
    pattern: "random" | "center" | "peripheral",
    count: number,
    seed: number,
    predicate?: (location: string) => boolean,
): string[] {
    let locations = childrenGeohashesAtPrecision(location, precision);

    // Filter using predicate if provided
    if (predicate) {
        locations = locations.filter(predicate);
    }

    switch (pattern) {
        case "random":
            return sampleFrom(locations, count, seed);
        case "center":
            const centerChars = location.length % 2 ? "dest67km" : "mtks7e6d";

            if (count > centerChars.length) {
                count = centerChars.length;
            }

            // Choose geohashes near the center
            return sampleFrom(
                locations.filter((s) => centerChars.includes(s.slice(-1))),
                count,
                seed,
            );
        case "peripheral":
            const peripheralChars =
                location.length % 2
                    ? "bcfguvyz89wx23qr0145hjnp"
                    : "prxznqwyjvhu5g4f139c028b";

            if (count > peripheralChars.length) {
                count = peripheralChars.length;
            }

            // Choose geohashes near the edges
            return sampleFrom(
                locations.filter((s) => peripheralChars.includes(s.slice(-1))),
                count,
                seed,
            );
    }
}

async function stencilFromBlueprint(
    location: string, // the blueprint geohash
    locationType: GeohashLocation,
    blueprint: BluePrint,
    predicate: (
        location: string,
        locationType: GeohashLocation,
    ) => Promise<boolean>,
): Promise<Stencil> {
    const propLocations: Stencil = {};
    for (const [
        cluster,
        { props, pattern, precision, min, max },
    ] of Object.entries(blueprint.clusters)) {
        let seed = stringToRandomNumber(location + locationType + cluster);

        // Determine the location of the cluster where the prop should be spawned
        const clusterLocations = sampleChildrenGeohashesAtPrecision(
            location,
            precision,
            pattern,
            seededRandomNumberBetween(min, max, seed),
            seed,
        );

        for (const clusterLocation of clusterLocations) {
            if (await predicate(clusterLocation, locationType)) {
                for (const [prop, { min, max, pattern }] of Object.entries(
                    props,
                )) {
                    let propSeed = stringToRandomNumber(clusterLocation + prop);
                    const propGeohashes = sampleChildrenGeohashesAtPrecision(
                        clusterLocation,
                        worldSeed.spatial.unit.precision,
                        pattern,
                        seededRandomNumberBetween(min, max, propSeed),
                        propSeed,
                    );
                    for (const geohash of propGeohashes) {
                        propLocations[geohash] = {
                            prop,
                            blueprint: blueprint.template,
                        };
                    }
                }
            }
        }
    }

    return propLocations;
}

import { seededRandom, stringToRandomNumber } from "$lib/utils";
import { worldSeed } from "../world/settings/world";
import { geohashLocationTypes, type LocationType } from "../world/types";
import type { Season, TimeOfDay } from "./time";

export { describeWeather };

function describeWeather({
    location,
    locationType,
    timeOfDay,
    season,
    time,
}: {
    location: string;
    locationType: LocationType;
    time: number;
    timeOfDay: TimeOfDay;
    season: Season;
}): string {
    const continent = worldSeed.seeds.continent[location.charAt(0)];
    if (!geohashLocationTypes.has(locationType) || !continent) {
        return "";
    }

    const {
        baseTemperature,
        temperatureVariation,
        rainProbability,
        stormProbability,
    } = continent.weather;

    // Smallest resolution for weather is at the city level
    const city = location.slice(0, worldSeed.spatial.city.precision);

    // Use `city` and `timeOfDay` seed the random number generation (else it will change every cell)
    const rv = seededRandom(stringToRandomNumber(city + timeOfDay));

    // Adjust temperature based on season and time of day
    let temperatureAdjustment = 0;
    switch (season) {
        case "summer":
            temperatureAdjustment += temperatureVariation / 2;
            break;
        case "winter":
            temperatureAdjustment -= temperatureVariation / 2;
            break;
    }

    switch (timeOfDay) {
        case "night":
            temperatureAdjustment -= temperatureVariation / 4;
            break;
        case "afternoon":
            temperatureAdjustment += temperatureVariation / 4;
            break;
    }

    const temperature =
        baseTemperature + rv * temperatureVariation + temperatureAdjustment;

    // Adjust rain and storm probabilities based on season
    let rainAdjustment = 0;
    let stormAdjustment = 0;
    switch (season) {
        case "spring":
            rainAdjustment = 0.1;
            break;
        case "autumn":
            rainAdjustment = 0.05;
            stormAdjustment = 0.05;
            break;
    }
    const isRaining = rv < rainProbability + rainAdjustment;
    const isStorming = rv < stormProbability + stormAdjustment;

    let weatherDescription = `The temperature is ${Math.round(temperature)}°C.`;

    if (isStorming) {
        weatherDescription +=
            " A fierce storm is raging, with heavy rain and strong winds.";
        const humidityDesc = getHumidityDesc(
            continent.biome.forest ?? 0,
            temperature,
        );
        weatherDescription += ` The air feels ${getTempDesc(temperature)}${humidityDesc ? " and " + humidityDesc : ""}.`;
    } else if (isRaining) {
        weatherDescription += " It is raining steadily.";
        const humidityDesc = getHumidityDesc(
            continent.biome.forest ?? 0,
            temperature,
        );
        weatherDescription += ` The air feels ${getTempDesc(temperature)}${humidityDesc ? " and " + humidityDesc : ""}.`;
    } else {
        weatherDescription += " The sky is clear.";
        const humidityDesc = getHumidityDesc(
            continent.biome.forest ?? 0,
            temperature,
        );
        if (humidityDesc) {
            weatherDescription += ` The air is ${getTempDesc(temperature)} and ${humidityDesc}.`;
        } else {
            weatherDescription += ` The air is ${getTempDesc(temperature)}.`;
        }
    }

    return weatherDescription;
}

// Function to get humidity description based on continent water level
const getHumidityDesc = (water: number, temp: number) => {
    if (water > 0.5) {
        if (temp > 25) return "humid";
        if (temp < 10) return "damp";
        return "moist";
    } else if (water < 0.2) {
        return "dry";
    }
    return ""; // For moderate humidity, we'll omit it from the description
};

// Function to get temperature description
const getTempDesc = (temp: number) => {
    if (temp > 30) return "hot";
    if (temp > 20) return "warm";
    if (temp > 10) return "cool";
    return "cold";
};

import { worldSeed } from "../world/settings/world";

export { describeTime, type Season, type TimeOfDay };

type TimeOfDay = "night" | "morning" | "afternoon" | "evening";
type Season = "summer" | "winter" | "spring" | "autumn";

function describeTime(time: number): {
    timeOfDay: TimeOfDay;
    season: Season;
    dayOfYear: number;
    description: string;
} {
    const { dayLengthHours, yearLengthDays, seasonLengthDays } = worldSeed.time;

    const hourOfDay = (time / (1000 * 60 * 60)) % dayLengthHours;
    const dayOfYear = Math.floor(time / (1000 * 60 * 60 * 24)) % yearLengthDays;
    const season = Math.floor(dayOfYear / seasonLengthDays) % 4;

    let timeOfDay: TimeOfDay;
    if (hourOfDay < 6) timeOfDay = "night";
    else if (hourOfDay < 12) timeOfDay = "morning";
    else if (hourOfDay < 18) timeOfDay = "afternoon";
    else timeOfDay = "evening";

    const seasons: Season[] = ["spring", "summer", "autumn", "winter"];
    const currentSeason = seasons[season];

    return {
        timeOfDay,
        season: currentSeason,
        dayOfYear,
        description: `It is ${timeOfDay} during the ${currentSeason} season.`,
    };
}

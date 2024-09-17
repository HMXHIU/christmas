import {
    learningDialoguesForSkill,
    skillLevelProgression,
} from "$lib/crossover/world/skills";
import { describe, expect, test } from "vitest";

describe("Skills Tests", () => {
    test("Test `skillLevelProgression`", async () => {
        expect(skillLevelProgression(0)).toBe(0);
        expect(skillLevelProgression(1)).toBe(100);
        expect(skillLevelProgression(20)).toBe(355000);
        expect(skillLevelProgression(50)).toBe(3355000);
    });

    test("Test `learningDialoguesForSkill`", async () => {
        expect(learningDialoguesForSkill("exploration", 2)).toMatchObject([
            "${teacher.name} hands you a worn map and a compass.",
            "'The world is vast and full of wonders, ${player.name},' ${teacher.name} says with a glint in their eye.",
            "You learn to read the map and orient yourself using the compass.",
            "A sense of excitement builds as you realize how much there is to discover.",
            "'Remember, the journey is as important as the destination,' ${teacher.name} advises.",
        ]);
        expect(learningDialoguesForSkill("exploration", 10)).toMatchObject([
            "${teacher.name} takes you to a shimmering portal pulsing with arcane energy.",
            "'Your final lesson is about exploring the impossible, ${player.name},' ${teacher.name} says excitedly.",
            "You step through the portal, experiencing different planes of existence.",
            "Reality bends around you, but your training keeps you grounded and observant.",
            "Returning, ${teacher.name} grins, 'The world is yours to explore, brave adventurer.'",
        ]);
        expect(learningDialoguesForSkill("exploration", 20)).toMatchObject([
            "${teacher.name} takes you to a shimmering portal pulsing with arcane energy.",
            "'Your final lesson is about exploring the impossible, ${player.name},' ${teacher.name} says excitedly.",
            "You step through the portal, experiencing different planes of existence.",
            "Reality bends around you, but your training keeps you grounded and observant.",
            "Returning, ${teacher.name} grins, 'The world is yours to explore, brave adventurer.'",
        ]);
    });
});

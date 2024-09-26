import { crossoverCmdSay } from "$lib/crossover/client";
import type { ItemEntity } from "$lib/crossover/types";
import { LOCATION_INSTANCE } from "$lib/crossover/world/settings";
import { generateNPC } from "$lib/server/crossover/npc";
import { generateInnKeeperQuests } from "$lib/server/crossover/quests/generator";
import { initializeClients } from "$lib/server/crossover/redis";
import { questWritsQuerySet } from "$lib/server/crossover/redis/queries";
import { beforeEach, expect, test } from "vitest";
import {
    collectAllEventDataForDuration,
    createGandalfSarumanSauron,
} from "../utils";

await initializeClients(); // create redis repositories

let { playerOne, playerOneCookies, playerOneStream } =
    await createGandalfSarumanSauron();

beforeEach(async () => {});

test("Test InnKeeper Generates Quests Automatically", async () => {});

test("Test Generate Generic Quests", async () => {
    // Generate innKeeper
    const innKeeper = await generateNPC("innkeeper", {
        demographic: {},
        appearance: {},
        geohash: playerOne.loc[0],
        locationInstance: LOCATION_INSTANCE,
        locationType: playerOne.locT,
    });

    // Generate quests for all inn keepers in the world
    await generateInnKeeperQuests();

    // Check inn keeper inventory
    const writs = (await questWritsQuerySet(
        innKeeper.player,
    ).returnAll()) as ItemEntity[];
    expect(writs).toMatchObject([
        {
            name: "Acquire goblin's blood for Alchemist",
            prop: "questwrit",
            loc: [innKeeper.player],
            locT: "inv",
            locI: "@",
            vars: {
                name: "Acquire goblin's blood for Alchemist",
            },
        },
        {
            name: "Acquire goblin's teeth for Blacksmith",
            prop: "questwrit",
            loc: [innKeeper.player],
            locT: "inv",
            locI: "@",
            vars: {
                name: "Acquire goblin's teeth for Blacksmith",
            },
        },
        {
            name: "Acquire goblin's intestines for Grocer",
            prop: "questwrit",
            loc: [innKeeper.player],
            locT: "inv",
            locI: "@",
            vars: {
                name: "Acquire goblin's intestines for Grocer",
            },
        },
    ]);
    expect(writs.length).toBe(3);

    // Test greet innKeeper for quests
    crossoverCmdSay(
        { target: innKeeper.player, message: "" },
        { Cookie: playerOneCookies },
    );
    var evs = await collectAllEventDataForDuration(playerOneStream);

    expect(evs).toMatchObject({
        feed: [
            {
                type: "message",
                message: "${message}",
                variables: {
                    cmd: "say",
                    player: innKeeper.player,
                    name: "Inn Keeper",
                    message:
                        "Inn Keeper greets you, 'Well met Gandalf, you may *rest* here'.",
                },
                event: "feed",
            },
            {
                type: "message",
                message: "${message}",
                variables: {
                    cmd: "say",
                    player: innKeeper.player,
                    name: "Inn Keeper",
                    message: `Quests:

Acquire goblin's blood for Alchemist *${writs[0].vars.quest}*
Acquire goblin's teeth for Blacksmith *${writs[1].vars.quest}*
Acquire goblin's intestines for Grocer *${writs[2].vars.quest}*

You can *ask Inn Keeper about [quest]*`,
                },
                event: "feed",
            },
        ],
        entities: [],
        cta: [],
        action: [],
    });
});

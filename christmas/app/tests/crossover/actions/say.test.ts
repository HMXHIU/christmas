import { crossoverCmdSay } from "$lib/crossover/client";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import { initializeClients } from "$lib/server/crossover/redis";
import { sleep } from "$lib/utils";
import { describe, expect, test } from "vitest";
import { createGandalfSarumanSauron, waitForEventData } from "../utils";

await initializeClients(); // create redis repositories
let {
    playerOne,
    playerOneCookies,
    playerTwo,
    playerTwoStream,
    playerThreeStream,
} = await createGandalfSarumanSauron();

describe("Say Tests", () => {
    test("Say to specific `target`", async () => {
        // `playerOne` says hello to `playerTwo`
        crossoverCmdSay(
            { message: "hello", target: playerTwo.player },
            { Cookie: playerOneCookies },
        );
        var feed = await waitForEventData(playerTwoStream, "feed");
        expect(feed).toMatchObject({
            type: "message",
            message: "${name} says ${message}",
            variables: {
                cmd: "say",
                player: playerOne.player,
                name: playerOne.name,
                message: "hello",
            },
            event: "feed",
        });
        await sleep(MS_PER_TICK * 2);

        // `playerOne` says hello to `playerTwo`, `playerThree` should not get message
        crossoverCmdSay(
            { message: "hello", target: playerTwo.player },
            { Cookie: playerOneCookies },
        );
        await expect(
            waitForEventData(playerThreeStream, "feed"),
        ).rejects.toThrowError("Timeout occurred while waiting for event");
        await sleep(MS_PER_TICK * 2);
    });

    test("Say to everyone", async () => {
        // `playerOne` says to everyone
        crossoverCmdSay({ message: "hello" }, { Cookie: playerOneCookies });
        await expect(
            waitForEventData(playerTwoStream, "feed"),
        ).resolves.toMatchObject({
            type: "message",
            message: "${name} says ${message}",
            variables: {
                cmd: "say",
                player: playerOne.player,
                name: playerOne.name,
                message: "hello",
            },
            event: "feed",
        });
        await expect(
            waitForEventData(playerThreeStream, "feed"),
        ).resolves.toMatchObject({
            type: "message",
            message: "${name} says ${message}",
            variables: {
                cmd: "say",
                player: playerOne.player,
                name: playerOne.name,
                message: "hello",
            },
            event: "feed",
        });
    });
});

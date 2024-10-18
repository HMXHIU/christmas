import { searchPossibleCommands } from "$lib/crossover/ir";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { actions } from "$lib/crossover/world/settings/actions";
import { SkillLinesEnum } from "$lib/crossover/world/skills";
import { describe, expect, test } from "vitest";
import {
    createGandalfSarumanSauron,
    createGoblinSpiderDragon,
    createTestItems,
} from "../utils";

describe("Test Command Searching", async () => {
    let { playerOne, playerTwo, playerThree } =
        await createGandalfSarumanSauron();
    let { woodenDoor, woodenClub, woodenClubThree, woodenClubTwo, portalOne } =
        await createTestItems({});
    let { goblin, goblinTwo, goblinThree, dragon } =
        await createGoblinSpiderDragon();

    test("Ability on self (no target provided)", async () => {
        const gameCommands = searchPossibleCommands({
            query: "heal",
            // Player
            player: playerOne,
            playerAbilities: [
                abilities.bruise,
                abilities.bandage, // requires a target
                abilities.heal, // doesnt require a target
            ],
            playerItems: [woodenClub],
            actions: [],
            // Environment
            monsters: [goblin, dragon],
            players: [playerOne], // Note: need to include self to bandage
            items: [woodenDoor],
            skills: [...SkillLinesEnum],
        }).commands;
        expect(gameCommands).toMatchObject([
            [
                {
                    ability: "heal",
                    type: "healing",
                    predicate: {
                        self: ["player", "monster"],
                        target: [],
                        targetSelfAllowed: true,
                    },
                },
                {
                    self: {
                        player: playerOne.player,
                        name: "Gandalf",
                    },
                },
            ],
        ]);
    });

    test("Ability on self (target provided)", async () => {
        const gameCommands = searchPossibleCommands({
            query: "bandage gandalf",
            // Player
            player: playerOne,
            playerAbilities: [abilities.bruise, abilities.bandage],
            playerItems: [woodenClub],
            actions: [],
            // Environment
            monsters: [goblin, dragon],
            players: [playerOne], // Note: need to include self to bandage
            items: [woodenDoor],
            skills: [...SkillLinesEnum],
        }).commands;
        expect(gameCommands).toMatchObject([
            [
                {
                    ability: "bandage",
                    type: "healing",
                    predicate: {
                        self: ["player", "monster"],
                        target: ["player", "monster"],
                        targetSelfAllowed: true,
                    },
                },
                {
                    self: {
                        player: playerOne.player,
                        name: "Gandalf",
                    },
                    target: {
                        player: playerOne.player,
                        name: "Gandalf",
                    },
                },
            ],
        ]);
    });

    test("Item utility on monster", async () => {
        goblin.loc = playerOne.loc;
        const gameCommands = searchPossibleCommands({
            query: "swing at goblin",
            // Player
            player: playerOne,
            playerAbilities: [abilities.bruise, abilities.bandage],
            playerItems: [woodenClub],
            actions: [],
            // Environment
            monsters: [goblin, dragon],
            players: [playerOne], // Note: need to include self to bandage
            items: [woodenDoor],
            skills: [...SkillLinesEnum],
        }).commands;
        expect(gameCommands).toMatchObject([
            [
                {
                    utility: "swing",
                    description: "Swing the club with all your strength.",
                    ability: "bruise",
                    requireEquipped: true,
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    target: {
                        monster: goblin.monster,
                        name: "goblin",
                        beast: "goblin",
                    },
                    item: {
                        item: woodenClub.item,
                        name: "Wooden Club",
                        prop: "woodenclub",
                    },
                },
            ],
        ]);
    });

    test("Both utility and ability", async () => {
        const gameCommands = searchPossibleCommands({
            query: "swing bruise at goblin",
            // Player
            player: playerOne,
            playerAbilities: [abilities.bruise, abilities.bandage],
            playerItems: [woodenClub],
            actions: [],
            // Environment
            monsters: [goblin, dragon],
            players: [playerOne], // Note: need to include self to bandage
            items: [woodenDoor],
            skills: [...SkillLinesEnum],
        }).commands;
        expect(gameCommands).toMatchObject([
            [
                {
                    ability: "bruise",
                    type: "offensive",
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    target: {
                        monster: goblin.monster,
                    },
                },
            ],
            [
                {
                    utility: "swing",
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    target: {
                        monster: goblin.monster,
                    },
                    item: {
                        item: woodenClub.item,
                    },
                },
            ],
        ]);
    });

    test("Non ability utility", async () => {
        playerOne.loc = woodenDoor.loc;
        const gameCommands = searchPossibleCommands({
            query: "open woodenDoor",
            // Player
            player: playerOne,
            playerAbilities: [abilities.bruise, abilities.bandage], // has swing action
            playerItems: [woodenClub], // has swing utility
            actions: [],
            // Environment
            monsters: [goblin, dragon],
            players: [playerOne], // Note: need to include self to bandage
            items: [woodenDoor],
            skills: [...SkillLinesEnum],
        }).commands;
        expect(gameCommands).toMatchObject([
            [
                {
                    utility: "open",
                    description: "Open the door.",
                    cost: {
                        charges: 0,
                        durability: 0,
                    },
                    state: {
                        start: "default",
                        end: "open",
                    },
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    item: {
                        item: woodenDoor.item,
                    },
                },
            ],
        ]);
    });

    test("Multiple of the same props present", async () => {
        woodenClub.loc =
            woodenClubTwo.loc =
            woodenClubThree.loc =
                playerOne.loc;
        const gameCommands = searchPossibleCommands({
            query: `take ${woodenClubThree.item}`,
            // Player
            player: playerOne,
            playerAbilities: [],
            playerItems: [],
            actions: [actions.take],
            // Environment
            monsters: [goblin, dragon],
            players: [playerOne], // Note: need to include self to bandage
            items: [woodenClub, woodenClubTwo, woodenClubThree],
            skills: [...SkillLinesEnum],
        }).commands;
        expect(gameCommands[0]).toMatchObject([
            {
                action: "take",
            },
            {
                self: {
                    player: playerOne.player,
                },
                target: {
                    item: woodenClubThree.item,
                },
            },
            {
                query: `take ${woodenClubThree.item}`,
            },
        ]);
    });

    test("Should show multiple similar items (sorted by relevance)", async () => {
        const gameCommands = searchPossibleCommands({
            query: `take woodenClub`,
            // Player
            player: playerOne,
            playerAbilities: [],
            playerItems: [],
            actions: [actions.take],
            // Environment
            monsters: [goblin, dragon],
            players: [playerOne], // Note: need to include self to bandage
            items: [woodenClub, woodenClubTwo, woodenClubThree],
            skills: [...SkillLinesEnum],
        }).commands;
        expect(gameCommands).toMatchObject([
            [
                {
                    action: actions.take.action,
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    target: {
                        item: woodenClub.item,
                    },
                },
                {
                    query: `take woodenclub`,
                },
            ],
            [
                {
                    action: actions.take.action,
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    target: {
                        item: woodenClubTwo.item,
                    },
                },
                {
                    query: `take woodenclub`,
                },
            ],
            [
                {
                    action: actions.take.action,
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    target: {
                        item: woodenClubThree.item,
                    },
                },
                {
                    query: `take woodenclub`,
                },
            ],
        ]);
    });

    test("Abilities should show multiple targets", async () => {
        goblin.loc = goblinTwo.loc = goblinThree.loc = playerOne.loc;
        const gameCommands = searchPossibleCommands({
            query: `bruise goblin`,
            // Player
            player: playerOne,
            playerAbilities: [abilities.bruise],
            playerItems: [],
            actions: [],
            // Environment
            monsters: [goblin, goblinTwo, goblinThree],
            players: [],
            items: [],
            skills: [...SkillLinesEnum],
        }).commands;
        expect(gameCommands).toMatchObject([
            [
                {
                    ability: "bruise",
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    target: {
                        monster: goblin.monster,
                    },
                },
            ],
            [
                {
                    ability: "bruise",
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    target: {
                        monster: goblinTwo.monster,
                    },
                },
            ],
            [
                {
                    ability: "bruise",
                },
                {
                    self: {
                        player: playerOne.player,
                    },
                    target: {
                        monster: goblinThree.monster,
                    },
                },
            ],
        ]);
    });
});

import { conditions } from "$lib/crossover/world/combat";
import { entityStats, resetEntityStats } from "$lib/crossover/world/entity";
import {
    LOCATION_INSTANCE,
    MS_PER_TICK,
    MS_PER_TURN,
    TICKS_PER_TURN,
} from "$lib/crossover/world/settings";
import { compendium } from "$lib/crossover/world/settings/compendium";
import {
    activeConditions,
    hasCondition,
    popCondition,
    pushCondition,
    resolveConditionsFromDamage,
} from "$lib/server/crossover/combat/condition";
import {
    entityDied,
    resolveDamage,
    respawnPlayer,
} from "$lib/server/crossover/combat/utils";
import { spawnItemInInventory } from "$lib/server/crossover/dm";
import type { MonsterEntity } from "$lib/server/crossover/types";
import { clone } from "lodash-es";
import { beforeEach, describe, expect, test } from "vitest";
import {
    createGandalfSarumanSauron,
    createGoblinSpiderDragon,
    resetEntityResources,
} from "./utils";

describe("Combat Tests", async () => {
    let {
        geohash,
        playerOne,
        playerOneCookies,
        playerTwoStream,
        playerOneStream,
        playerTwo,
    } = await createGandalfSarumanSauron();

    let { goblin, goblinTwo } = await createGoblinSpiderDragon(geohash);

    beforeEach(async () => {
        playerOne.loc = [geohash];
        playerTwo.loc = [geohash];
        await resetEntityResources(playerOne, playerTwo);
    });

    test("Test `resolveDamage`", async () => {
        goblinTwo = resetEntityStats(goblinTwo) as MonsterEntity;
        expect(
            resolveDamage({
                attacker: playerTwo,
                defender: goblinTwo,
                bodyPartHit: "torso",
                dieRoll: { count: 1, sides: 6 },
            }),
        ).toMatchObject({
            damage: 4,
            defender: {
                monster: goblinTwo.monster,
                hp: 6,
            },
        });

        // Check with equipment damage reduction
        goblinTwo = resetEntityStats(goblinTwo) as MonsterEntity;
        const steelPlate = await spawnItemInInventory({
            entity: playerTwo,
            prop: compendium.steelplate.prop,
        });
        expect(
            resolveDamage({
                attacker: playerTwo,
                defender: goblinTwo,
                bodyPartHit: "torso",
                dieRoll: { count: 1, sides: 6 },
                equipment: steelPlate,
            }),
        ).toMatchObject({
            damage: 0,
            defender: {
                monster: goblinTwo.monster,
                hp: 10,
            },
        });
    });

    test("Test conditions", async () => {
        // Test `resolveConditionsFromDamage`
        const now = Date.now();
        var defender = resolveConditionsFromDamage({
            defender: goblin,
            attacker: playerOne,
            damage: 1,
            damageType: "fire",
            now,
        });
        expect(defender.cond).toMatchObject([
            `a:burning:${now + MS_PER_TURN * conditions.burning.turns}:${playerOne.player}`,
        ]);

        // Test `hasCondition`
        expect(
            hasCondition(defender.cond, "burning", now + MS_PER_TICK),
        ).toBeTruthy();
        expect(
            hasCondition(defender.cond, "frozen", now + MS_PER_TICK),
        ).toBeFalsy();
        expect(
            hasCondition(defender.cond, "burning", now + MS_PER_TURN * 10), // expired
        ).toBeFalsy();

        // Test `pushCondition`
        defender.cond = pushCondition(defender.cond, "burning", playerOne, now);
        defender.cond = pushCondition(defender.cond, "burning", playerOne, now);
        expect(defender.cond).toMatchObject([
            `a:burning:${now + MS_PER_TURN * conditions.burning.turns}:${playerOne.player}`,
        ]);

        // Test `popCondition`
        defender.cond = popCondition(defender.cond, "burning", now);
        expect(defender.cond.length).toBe(0);

        // Test `activeConditions`
        defender.cond = pushCondition(defender.cond, "burning", playerOne, now);
        defender.cond = pushCondition(
            defender.cond,
            "bleeding",
            playerOne,
            now,
        );
        defender.cond = pushCondition(
            defender.cond,
            "weakness",
            playerOne,
            now,
        );
        expect(activeConditions(defender.cond)).toMatchObject([
            `a:bleeding:${now + MS_PER_TURN * conditions.bleeding.turns}:${playerOne.player}`,
            `a:burning:${now + MS_PER_TURN * conditions.burning.turns}:${playerOne.player}`,
        ]);
    });

    test("Test `entityDied`", () => {
        const playerOneAfter = clone(playerOne);
        playerOneAfter.hp = 0;
        expect(entityDied(playerOne, playerOneAfter)).toBe(true);
    });

    test("Test `respawnPlayer`", async () => {
        playerOne.hp = 0;
        playerOne.cha = 0;
        playerOne.mnd = 0;
        playerOne.lum = 10;
        playerOne.umb = 10;
        expect(await respawnPlayer(playerOne)).toMatchObject({
            ...entityStats(playerOne),
            lum: Math.floor(10 / 2),
            umb: Math.floor(10 / 2),
            buclk: MS_PER_TICK * TICKS_PER_TURN * 10,
            locT: "geohash",
            locI: LOCATION_INSTANCE,
        });
    });
});

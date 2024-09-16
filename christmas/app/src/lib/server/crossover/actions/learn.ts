import { actions } from "$lib/crossover/world/actions";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import { skillLines } from "$lib/crossover/world/settings/skills";
import {
    learningDialoguesForSkill,
    skillLevelProgression,
    type SkillLines,
} from "$lib/crossover/world/skills";
import { type GeohashLocationType } from "$lib/crossover/world/types";
import { generatePin, sleep, substituteVariables } from "$lib/utils";
import { say } from ".";
import { isEntityHuman } from "../npc";
import {
    createP2PTransaction,
    type CTA,
    type P2PLearnTransaction,
} from "../player";
import {
    fetchEntity,
    getNearbyPlayerIds,
    itemRepository,
    saveEntity,
} from "../redis";
import { type ItemEntity, type PlayerEntity } from "../redis/entities";
import {
    publishActionEvent,
    publishAffectedEntitiesToPlayers,
    publishFeedEvent,
    savePlayerState,
} from "../utils";

export { createLearnCTA, executeLearnCTA, learn };

async function executeLearnCTA(
    executor: PlayerEntity,
    p2pLearnTx: P2PLearnTransaction,
    writ?: ItemEntity, // writ to destroy once fulfilled
) {
    const { teacher, skill, player } = p2pLearnTx;

    // Check that the player executing the p2pLearnTx is the teacher
    if (executor.player !== teacher) {
        publishFeedEvent(executor.player, {
            type: "error",
            message: `You try to execute the agreement, but it rejects you with a slight jolt.`,
        });
    }

    await learn(
        (await fetchEntity(player)) as PlayerEntity, // get the student from the writ
        teacher,
        skill,
        writ,
    );
}

async function createLearnCTA(
    player: PlayerEntity,
    teacher: PlayerEntity,
    skill: SkillLines,
): Promise<CTA> {
    // Teacher is a human player - request a P2PLearnTransaction and terminate early
    if (isEntityHuman(teacher)) {
        const expiresIn = 60;
        const pin = generatePin(4);
        const learnTx: P2PLearnTransaction = {
            transaction: "learn",
            teacher: teacher.player,
            player: player.player,
            skill,
        };
        return {
            name: "Writ of Learning",
            description: `${player.name} requests to learn ${skill} from you. You have ${expiresIn} to *accept ${pin}*`,
            token: await createP2PTransaction(learnTx, 60),
            pin,
        };
    }

    throw new Error("Teacher is not a player");
}

async function learn(
    player: PlayerEntity,
    teacher: string,
    skill: SkillLines,
    writ?: ItemEntity, // writ to destroy once fulfilled
): Promise<PlayerEntity> {
    const playerIsHuman = isEntityHuman(player);
    const teacherEntity = (await fetchEntity(teacher)) as PlayerEntity;
    const [canLearn, cannotLearnMessage] = canLearnSkillFrom(
        player,
        teacherEntity,
        skill,
    );

    // Cannot learn - send `cannotLearnMessage` back to player
    if (!canLearn && playerIsHuman) {
        await say(teacherEntity, cannotLearnMessage, {
            target: player.player,
            overwrite: true,
        });
        return player;
    }

    // Get nearby players
    const nearbyPlayerIds = await getNearbyPlayerIds(
        player.loc[0],
        player.locT as GeohashLocationType,
        player.locI,
    );

    // Publish action event
    publishActionEvent(nearbyPlayerIds, {
        action: "learn",
        source: teacher,
        target: player.player,
    });

    // Consume learning resources and increment player skill
    let deduct = skillLevelProgression(player.skills[skill] ?? 1);
    for (const cur of skillLines[skill].currency) {
        if (deduct > 0) {
            player[cur] = Math.max(player[cur] - deduct, 0);
            deduct -= player[cur];
        }
    }
    if (player.skills[skill]) {
        player.skills[skill] += 1;
    } else {
        player.skills[skill] = 1;
    }

    // Save player
    player = (await saveEntity(player)) as PlayerEntity;
    await savePlayerState(player.player);

    // Destroy writ if provided
    if (writ) {
        await itemRepository.remove(writ.item);
    }

    // Publish to nearby players
    publishAffectedEntitiesToPlayers([player], {
        publishTo: nearbyPlayerIds,
        op: "upsert",
    });

    // Send learning dialogues
    if (playerIsHuman) {
        // Get skill learning dialogues
        const learningDialogues = learningDialoguesForSkill(
            skill,
            player.skills[skill] ?? 1,
        );
        // Start the lesson
        for (const msg of learningDialogues) {
            const message = substituteVariables(msg, {
                player,
                teacher: teacherEntity,
                skill: skillLines[skill],
            });
            await say(teacherEntity, message, {
                target: player.player,
                overwrite: true,
            });
            await sleep(
                (actions.learn.ticks * MS_PER_TICK) / learningDialogues.length,
            );
        }
    }

    return player;
}

function canLearnSkillFrom(
    player: PlayerEntity,
    teacher: PlayerEntity,
    skill: SkillLines,
): [boolean, string] {
    if (!teacher.player) {
        return [false, "You might as well try to learn from a rock."];
    }

    // Can only learn up to teacher's skill level - 1
    const playerSkillLevel = player.skills[skill] ?? 0;
    const currencies = skillLines[skill].currency;
    const playerCurrency = currencies.reduce((p, c) => p + player[c], 0);
    const requiredCurrency = skillLevelProgression(playerSkillLevel + 1);

    // Teacher not at skill level
    if (
        !teacher.skills[skill] ||
        teacher.skills[skill] - 1 < playerSkillLevel
    ) {
        return [
            false,
            `${teacher.name} furrows his brow. 'This skill lies beyond even my grasp. Seek out one more learned than I.'`,
        ];
    }
    // Player not enough learning resources
    else if (playerCurrency < requiredCurrency) {
        return [
            false,
            "Despite your best efforts, the skill eludes you, perhaps with more experience.",
        ];
    }

    return [true, ""];
}

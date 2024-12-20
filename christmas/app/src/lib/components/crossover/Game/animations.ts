import { type Abilities, type Procedure } from "$lib/crossover/world/abilities";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import { abilities } from "$lib/crossover/world/settings/abilities";
import { sleep } from "$lib/utils";
import { Sound } from "@pixi/sound";
import { gsap } from "gsap";
import { Assets, Container, MeshRope, Point, type PointData } from "pixi.js";
import type { EntityContainer } from "./entities";
import { layers } from "./layers";
import { getAngle } from "./utils";

export { animateAbility, animateSlash };

type Timeline = any;

async function animateAbility(
    stage: Container,
    {
        source,
        target,
        ability,
    }: {
        source: EntityContainer;
        target?: EntityContainer;
        ability: Abilities;
    },
) {
    const { procedures, type } = abilities[ability];
    for (let procedure of procedures) {
        const [ptype, effect] = procedure;
        const { ticks, dieRoll } = effect;
        await addVisualEffects(gsap.timeline(), stage, {
            source,
            target,
            procedure,
        });
        await addSoundEffects(gsap.timeline(), procedure);
        await sleep(ticks * MS_PER_TICK);
    }
}

async function addVisualEffects(
    tl: Timeline,
    stage: Container,
    {
        source,
        target,
        procedure,
    }: {
        source: EntityContainer;
        target?: EntityContainer;
        procedure: Procedure;
    },
) {
    const [ptype, effect] = procedure;
    const { ticks, dieRoll } = effect;
    if (ptype === "action" && source.isoPosition != null) {
        // Animate offensive damage abilities
        if (dieRoll != null && target != null) {
            if (
                // dieRoll.damageType === "slashing" &&
                target.isoPosition != null
            ) {
                tl.add(
                    await animateSlash(stage, tl, {
                        startX: source.isoPosition.isoX,
                        startY:
                            source.isoPosition.isoY -
                            source.isoPosition.elevation,
                        endX: target.isoPosition.isoX,
                        endY:
                            target.isoPosition.isoY -
                            target.isoPosition.elevation,
                    }),
                );
            }
        }
    }
}

async function addSoundEffects(tl: Timeline, procedure: Procedure) {
    const soundEffects = await Assets.loadBundle("sound-effects");
    const [ptype, effect] = procedure;
    const { ticks, dieRoll } = effect;
    if (ptype === "action") {
        // Offensive damage abilities
        if (dieRoll != null) {
            const { damageType, sides } = dieRoll;
            // Slashing
            if (damageType === "slashing") {
                // const duration = slashing.duration / 0.5;
                tl.add(() => {
                    Sound.from(soundEffects.slashing).play();
                });
            }
            // Blood
            if (sides > 10) {
                tl.add(() => {
                    Sound.from(soundEffects.blood).play();
                });
            }
        }
    }
}

async function animateSlash(
    stage: Container,
    tl: Timeline,
    {
        startX,
        startY,
        endX,
        endY,
    }: { startX: number; startY: number; endX: number; endY: number },
) {
    const slashTrailTexture = (await Assets.loadBundle("effects")).effects
        .textures["trail"];
    const ropeSize = 20;
    let arc: PointData[] = [];
    const arcRadius = Math.PI / 4;
    const halfArcRadius = arcRadius / 2;

    const radius = Math.sqrt(
        Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2),
    );
    const angleToTarget = getAngle(startX, startY, endX, endY);
    const deltaTheta = arcRadius / ropeSize;

    // Create arc
    for (let i = 0; i < ropeSize; i++) {
        const theta = angleToTarget - halfArcRadius + deltaTheta * i;
        arc.push(
            new Point(
                startX + Math.cos(theta) * radius,
                startY + Math.sin(theta) * radius,
            ),
        );
    }

    const rope = new MeshRope({ texture: slashTrailTexture, points: arc });
    rope.autoUpdate = true;

    rope.zIndex = layers.layers.length; // render effects last
    stage.addChild(rope);

    // Animation
    const animationDuration = 0.7; // seconds
    const fadeOutDuration = 0.2; // seconds

    // Animate the rope appearance and extension
    tl.to(rope, {
        alpha: 1,
        duration: animationDuration,
        onUpdate: function () {
            const progress = tl.progress();
            let newArc: PointData[] = []; // updating the points directly doesn't work
            for (let i = 0; i < ropeSize; i++) {
                newArc.push(
                    new Point(
                        startX * (1 - progress) + arc[i].x * progress,
                        startY * (1 - progress) + arc[i].y * progress,
                    ),
                );
            }
            arc = newArc;
        },
    });

    // Fade out the rope
    tl.to(rope, {
        alpha: 0,
        duration: fadeOutDuration,
        onComplete: () => {
            stage.removeChild(rope);
            rope.destroy();
        },
    });
}

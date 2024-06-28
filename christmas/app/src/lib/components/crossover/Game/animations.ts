import { abilities, type Abilities } from "$lib/crossover/world/abilities";
import { gsap } from "gsap";
import { Assets, Container, MeshRope, Point, type PointData } from "pixi.js";
import { RENDER_ORDER, getAngle, type EntityMesh } from "./utils";

export { animateAbility, animateSlash };

async function animateAbility(
    stage: Container,
    {
        source,
        targets,
        ability,
    }: {
        source: EntityMesh;
        targets: EntityMesh[];
        ability: Abilities;
    },
) {
    const { procedures, type } = abilities[ability];

    if (type === "offensive") {
        for (let target of targets) {
            for (let [ptype, effect] of procedures) {
                if (ptype === "action") {
                    const { ticks, damage, buffs, debuffs } = effect;
                    // Animate offensive damage abilities
                    if (damage != null) {
                        const { damageType, amount } = damage;
                        if (damageType === "slashing") {
                            console.log("Slashing damage", amount);
                            animateSlash(stage, {
                                startX: source.position.isoX,
                                startY:
                                    source.position.isoY -
                                    source.position.elevation,
                                endX: target.position.isoX,
                                endY:
                                    target.position.isoY -
                                    target.position.elevation,
                            });
                        }
                    }
                }
            }
        }
    }
}

async function animateSlash(
    stage: Container,
    {
        startX,
        startY,
        endX,
        endY,
    }: { startX: number; startY: number; endX: number; endY: number },
) {
    // Load the texture for rope.
    const trailTexture = await Assets.load(
        "https://pixijs.com/assets/trail.png",
    );

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

    const rope = new MeshRope({ texture: trailTexture, points: arc });
    rope.autoUpdate = true;

    rope.zIndex = RENDER_ORDER.effects * endY;

    stage.addChild(rope);

    // Animation
    const animationDuration = 0.7; // seconds
    const fadeOutDuration = 0.2; // seconds

    // Create a timeline for the animation
    const tl = gsap.timeline();

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

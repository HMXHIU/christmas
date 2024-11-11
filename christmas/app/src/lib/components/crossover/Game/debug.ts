import { isGeohashTraversableClient } from "$lib/crossover/game";
import {
    autoCorrectGeohashPrecision,
    getAllUnitGeohashes,
} from "$lib/crossover/utils";
import { worldSeed } from "$lib/crossover/world/settings/world";
import {
    geohashLocationTypes,
    type GeohashLocation,
} from "$lib/crossover/world/types";
import { poisInWorld } from "$lib/crossover/world/world";
import { Container, Graphics } from "pixi.js";
import { get } from "svelte/store";
import { itemRecord, worldRecord } from "../../../../store";
import type { EntityContainer } from "./entities";
import { SimpleEntityContainer } from "./entities/SimpleEntityContainer";
import { uiColors } from "./settings";
import { calculatePosition } from "./utils";

export { debugEC, debugGame };

let colliders: Graphics[] = [];

async function debugEC(ec: EntityContainer) {
    const bounds = ec.getLocalBounds();
    ec.addChild(
        new Graphics()
            .rect(bounds.x, bounds.y, bounds.width, bounds.height)
            .stroke({ color: uiColors.lumina, width: 2 / ec.scale.x }),
    );

    if (ec instanceof SimpleEntityContainer && ec.mesh) {
        const origin = new Graphics()
            .circle(ec.pivot.x, ec.pivot.y, 2)
            .stroke({ color: uiColors.health, width: 2 / ec.scale.x });
        ec.addChild(origin);
    }
}

async function debugGame(
    stage: Container,
    locationInstance: string,
    locationType: GeohashLocation,
) {
    // Clear colliders
    for (const c of colliders) {
        c.destroy();
    }

    // Draw item colliders (in the same locationInstance and locationType)
    for (const item of Object.values(get(itemRecord))) {
        if (
            !geohashLocationTypes.has(item.locT) ||
            item.locT !== locationType ||
            item.locI !== locationInstance
        ) {
            continue;
        }
        for (const loc of item.loc) {
            if (
                !(await isGeohashTraversableClient(
                    loc,
                    item.locT as GeohashLocation,
                    item.locI,
                ))
            ) {
                const itemPosition = await calculatePosition(
                    loc,
                    item.locT as GeohashLocation,
                    locationInstance,
                );
                colliders.push(
                    stage.addChild(
                        new Graphics()
                            .circle(
                                itemPosition.isoX,
                                itemPosition.isoY - itemPosition.elevation,
                                5,
                            )
                            .stroke({ color: 0xff0000 }),
                    ),
                );
            }
        }
    }

    // Debug world (in the same locationType)
    for (const [town, worlds] of Object.entries(get(worldRecord))) {
        for (const world of Object.values(worlds)) {
            if (
                !geohashLocationTypes.has(world.locT) ||
                world.locT !== locationType
            ) {
                continue;
            }

            // Draw world origin (purple hollow circle)
            const origin = autoCorrectGeohashPrecision(
                world.loc[0],
                worldSeed.spatial.unit.precision,
            );
            const originPosition = await calculatePosition(
                origin,
                world.locT as GeohashLocation,
                locationInstance,
            );
            colliders.push(
                stage.addChild(
                    new Graphics()
                        .circle(
                            originPosition.isoX,
                            originPosition.isoY - originPosition.elevation,
                            8,
                        )
                        .stroke({ color: 0xff00ff }),
                ),
            );

            // Draw world colliders (red hollow circle)
            for (const plot of world.loc) {
                for (const loc of getAllUnitGeohashes(plot)) {
                    if (
                        !(await isGeohashTraversableClient(
                            loc,
                            world.locT as GeohashLocation,
                            locationInstance,
                        ))
                    ) {
                        const pos = await calculatePosition(
                            loc,
                            world.locT as GeohashLocation,
                            locationInstance,
                        );
                        colliders.push(
                            stage.addChild(
                                new Graphics()
                                    .circle(
                                        pos.isoX,
                                        pos.isoY - pos.elevation,
                                        5,
                                    )
                                    .stroke({ color: 0xff0000 }),
                            ),
                        );
                    }
                }
            }

            // Draw world pois
            const pois = await poisInWorld(world);
            for (const poi of pois) {
                // Item POI (green circle)
                if ("prop" in poi) {
                    const { geohash, prop } = poi;
                    const pos = await calculatePosition(
                        geohash,
                        world.locT as GeohashLocation,
                        locationInstance,
                    );
                    colliders.push(
                        stage.addChild(
                            new Graphics()
                                .circle(pos.isoX, pos.isoY - pos.elevation, 5)
                                .stroke({ color: 0x00ff00 }),
                        ),
                    );
                }
                // Monster POI (teal circle)
                else if ("beast" in poi) {
                    const { geohash, beast } = poi;
                    const pos = await calculatePosition(
                        geohash,
                        world.locT as GeohashLocation,
                        locationInstance,
                    );
                    colliders.push(
                        stage.addChild(
                            new Graphics()
                                .circle(pos.isoX, pos.isoY - pos.elevation, 5)
                                .stroke({ color: 0x00ffff }),
                        ),
                    );
                }
            }
        }
    }
}

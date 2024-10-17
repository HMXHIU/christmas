import { GAME_MORPHOLOGY } from "$lib/crossover/defs";
import type {
    Actor,
    Creature,
    Item,
    Monster,
    PathParams,
    Player,
} from "$lib/crossover/types";
import {
    geohashesNearby,
    getEntityId,
    isEntityInMotion,
} from "$lib/crossover/utils";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import { actions } from "$lib/crossover/world/settings/actions";
import { bestiary } from "$lib/crossover/world/settings/bestiary";
import { compendium } from "$lib/crossover/world/settings/compendium";
import {
    geohashLocationTypes,
    type GeohashLocation,
} from "$lib/crossover/world/types";
import { AsyncLock } from "$lib/utils";
import { Container } from "pixi.js";
import { get } from "svelte/store";
import { player, target } from "../../../../../store";
import { layers } from "../layers";
import { ISO_CELL_HEIGHT, ISO_CELL_WIDTH } from "../settings";
import {
    calculatePosition,
    getAvatarMetadata,
    isCellInView,
    scaleToFitAndMaintainAspectRatio,
    type Position,
} from "../utils";
import { AvatarEntityContainer } from "./AvatarEntityContainer";
import { EntitySigil } from "./EntitySigil";
import { SimpleEntityContainer } from "./SimpleEntityContainer";

export {
    cullAllEntityContainers,
    cullEntityContainerById,
    entityContainers,
    entitySigils,
    garbageCollectEntityContainers,
    upsertEntityContainer,
    upsertEntitySigil,
    type EntityContainer,
};

type EntityContainer = SimpleEntityContainer | AvatarEntityContainer;

let entityContainers: Record<string, EntityContainer> = {};
let entitySigils: Record<string, EntitySigil> = {};

async function upsertEntitySigil(
    ec: EntityContainer,
    stage: Container,
): Promise<EntitySigil> {
    // Check if already exists
    if (entitySigils[ec.entityId]) {
        entitySigils[ec.entityId].updateUI();
        return entitySigils[ec.entityId];
    }

    // Create sigil
    const sigil = new EntitySigil(ec);
    sigil.zIndex = layers.layers.length + 1; // UI
    entitySigils[ec.entityId] = sigil;
    stage.addChild(sigil);
    return entitySigils[ec.entityId];
}

const upsertEntityContainerLock = new AsyncLock();
async function upsertEntityContainer(
    entity: Actor,
    stage: Container,
): Promise<[boolean, SimpleEntityContainer | AvatarEntityContainer]> {
    return upsertEntityContainerLock.withLock(async () => {
        if (!geohashLocationTypes.has(entity.locT)) {
            throw new Error("entity location is not a GeohashLocation");
        }
        const [entityId, entityType] = getEntityId(entity);

        // Get position
        const position = await calculatePosition(
            entity.loc[0],
            entity.locT as GeohashLocation,
            entity.locI,
        );
        const { row, col } = position;

        // Get player position & determine if tween is required if entity is in player's view
        const playerId = get(player)?.player;
        let tween = false;
        if (
            playerId != null &&
            entityContainers[playerId] != null &&
            entityContainers[playerId].isoPosition != null
        ) {
            // Ignore entities outside player's view
            tween = isCellInView(
                { row, col },
                entityContainers[playerId].isoPosition,
            );
        }

        // Create/Update container
        const [created, ec] =
            entityType === "player"
                ? await upsertAvatarContainer(entity as Player)
                : await upsertSimpleContainer(entity as Monster | Item);

        // Add to stage (might have been culled)
        if (!stage.children.includes(ec)) {
            stage.addChild(ec);
        }

        // Set initial position
        if (created) {
            ec.setIsoPosition(position);

            // Debug bounds
            // stage.addChild(debugBounds(ec));
        }

        // Update position
        else {
            if (entityType == "player" || entityType == "monster") {
                // Entity is moving
                if (isEntityInMotion(entity as Creature)) {
                    await ec.followPath(entity as PathParams);
                } else {
                    ec.setIsoPosition(position);
                }
            } else {
                ec.setIsoPosition(
                    position,
                    tween
                        ? (actions.move.ticks * MS_PER_TICK) / 1000
                        : undefined,
                );
            }
        }

        return [created, ec];
    });
}

async function upsertAvatarContainer(
    entity: Player,
): Promise<[boolean, AvatarEntityContainer]> {
    const [entityId, entityType] = getEntityId(entity);
    let ec = entityContainers[entityId] as AvatarEntityContainer;

    // Create
    if (ec == null) {
        if (!entity.avatar) {
            throw new Error(`${entity.player} is missing avatar url`);
        }

        const { avatar, animation } = await getAvatarMetadata(entity.avatar);

        ec = new AvatarEntityContainer({
            entity,
            ...layers.depthPartition("entity"),
        });
        await ec.avatar.loadFromMetadata(avatar, entityId, GAME_MORPHOLOGY);
        ec.avatar.animationManager.load(animation);
        entityContainers[entityId] = ec;

        // Set initial pose
        await ec.avatar.pose(ec.avatar.animationManager.getPose("default"));

        // Set size (must do after pose)
        const { width, height, scale } = scaleToFitAndMaintainAspectRatio(
            ec.width,
            ec.height,
            ISO_CELL_WIDTH * 1.25, // max width is 1 cell
            ISO_CELL_HEIGHT * 3.5, // max height is 3 cells
        );
        ec.scale.x = scale;
        ec.scale.y = scale;

        return [true, ec];
    }
    // Update
    else {
        return [false, ec];
    }
}

async function upsertSimpleContainer(
    entity: Monster | Item,
): Promise<[boolean, SimpleEntityContainer]> {
    const [entityId, entityType] = getEntityId(entity);
    let ec = entityContainers[entityId] as SimpleEntityContainer;

    // Create
    if (ec == null) {
        // Create entity container
        ec = new SimpleEntityContainer({
            entity,
            ...layers.depthPartition("entity"),
        });
        entityContainers[entityId] = ec;

        // Load monster asset
        if (entityType === "monster") {
            const monster = entity as Monster;
            const asset = bestiary[monster.beast].asset;
            await ec.loadAsset(asset, { anchor: { x: 0.5, y: 1 } });
        }
        // Load item asset
        else if (entityType === "item") {
            const item = entity as Item;
            const prop = compendium[item.prop];
            const asset = prop.asset;

            // Item has no asset (text only)
            if (!asset) {
                return [false, ec];
            }

            const variant = prop.states[item.state].variant;
            await ec.loadAsset(asset, { variant });

            // Set size pf dropped equipment
            if (prop.equipmentSlot != null) {
                const { scale } = scaleToFitAndMaintainAspectRatio(
                    ec.width,
                    ec.height,
                    ISO_CELL_WIDTH * (asset.width ?? 1),
                    ISO_CELL_HEIGHT * (asset.height ?? 1),
                );
                ec.scale.x = scale;
                ec.scale.y = scale;
            }
        }
        // Load player (for testing - should be avatar ec)
        else if (entityType === "player") {
            const asset = bestiary["goblin"].asset;
            await ec.loadAsset(asset, { anchor: { x: 0.5, y: 1 } });
        }

        // Set event listeners
        ec.eventMode = "static";
        ec.interactiveChildren = false; // Prevents mouse events from bubbling to children
        ec.hitArea = ec.getBounds(true).rectangle;
        ec.onmouseover = () => onMouseOverEntity(ec.entityId);
        ec.onmouseleave = () => onMouseLeaveEntity(ec.entityId);
        ec.onclick = () => onClickEntity(ec.entity);

        return [true, ec];
    }
    // Update
    else {
        // Swap variant when state changes
        if (entityType === "item") {
            const item = entity as Item;
            const prop = compendium[item.prop];
            const variant = prop.states[item.state].variant;
            ec.swapVariant(variant);
        }
        return [false, ec];
    }
}

/**
 * Destroy unused ecs (very far away, not in environment)
 *
 * @param playerPosition - The player's position, if undefined, cull all entities
 */
function garbageCollectEntityContainers(playerPosition: Position) {
    const p5s = geohashesNearby(playerPosition.geohash.slice(0, -2));
    for (const [id, ec] of Object.entries(entityContainers)) {
        const geohash = ec.isoPosition?.geohash;
        const locationType = ec.isoPosition?.locationType;
        if (geohash && locationType) {
            // Both are geohash locations but are not equal (ie. underground vs above ground)
            if (
                geohashLocationTypes.has(locationType) &&
                geohashLocationTypes.has(playerPosition.locationType) &&
                playerPosition.locationType !== locationType
            ) {
                cullEntityContainerById(id);
            }
            // Not nearby
            else if (!p5s.some((gh) => geohash.startsWith(gh))) {
                cullEntityContainerById(id);
            }
        }
        // Not in environment
        else {
            cullEntityContainerById(id);
        }
    }
}

function cullAllEntityContainers() {
    for (const [id, ec] of Object.entries(entityContainers)) {
        cullEntityContainerById(id);
    }
}

function cullEntityContainerById(entityId: string) {
    if (entityContainers[entityId]) {
        entityContainers[entityId].destroy();
        delete entityContainers[entityId];
    }
}

function onMouseOverEntity(entityId: string) {
    const ec = entityContainers[entityId];
    const t = get(target);

    // Highlight if entity is not target (already highlighted)
    if ((t == null || getEntityId(t)[0] != entityId) && ec != null) {
        ec.highlight(1);
    }
}

function onMouseLeaveEntity(entityId: string) {
    // Clear highlight if entity is not target
    const ec = entityContainers[entityId];
    const t = get(target);
    if ((t == null || getEntityId(t)[0] != entityId) && ec != null) {
        ec.clearHighlight();
    }
}

function onClickEntity(entity: Actor) {
    // Set target
    target.set(entity);
}

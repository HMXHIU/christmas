import { geohashesNearby, getEntityId } from "$lib/crossover/utils";
import { actions } from "$lib/crossover/world/actions";
import { avatarMorphologies, bestiary } from "$lib/crossover/world/bestiary";
import { compendium } from "$lib/crossover/world/compendium";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import type {
    EntityType,
    Item,
    Monster,
    PathParams,
    Player,
} from "$lib/server/crossover/redis/entities";
import { Assets, Container } from "pixi.js";
import { get } from "svelte/store";
import { player, target } from "../../../../../store";
import {
    calculatePosition,
    isCellInView,
    ISO_CELL_HEIGHT,
    ISO_CELL_WIDTH,
    RENDER_ORDER,
    scaleToFitAndMaintainAspectRatio,
    Z_OFF,
    Z_SCALE,
    type Position,
} from "../utils";
import { AvatarEntityContainer } from "./AvatarEntityContainer";
import { SimpleEntityContainer } from "./SimpleEntityContainer";

export {
    cullEntityContainers,
    entityContainers,
    updateEntities,
    upsertEntityContainer,
    type AvatarEntityContainer,
    type EntityContainer,
};

type EntityContainer = SimpleEntityContainer | AvatarEntityContainer;

let entityContainers: Record<string, EntityContainer> = {};

async function updateEntities(
    er: Record<string, Monster | Player | Item>,
    entityType: EntityType,
    stage: Container,
) {
    // Upsert entities (only locT = geohash)
    let upserted = new Set<string>();
    for (const entity of Object.values(er)) {
        if (entity.locT === "geohash") {
            await upsertEntityContainer(entity, stage);
            upserted.add(getEntityId(entity)[0]);
        }
    }

    // Destroy entities not in record (exclude player)
    const self = get(player);
    for (const [id, ec] of Object.entries(entityContainers)) {
        if (
            ec.entity == null ||
            self == null ||
            id === self.player ||
            upserted.has(id) ||
            ec.entityType !== entityType
        ) {
            continue;
        }
        ec.destroy();
        delete entityContainers[id];
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

function onClickEntity(entity: Player | Item | Monster) {
    // Set target
    target.set(entity);
}

async function upsertAvatarContainer(
    entity: Player | Monster | Item,
): Promise<[boolean, AvatarEntityContainer]> {
    const [entityId, entityType] = getEntityId(entity);
    let ec = entityContainers[entityId] as AvatarEntityContainer;

    // Create
    if (ec == null) {
        const morphology = avatarMorphologies["humanoid"]; // TODO: get from bestiary

        ec = new AvatarEntityContainer({
            entity,
            zOffset: Z_OFF.entity,
            zScale: Z_SCALE,
            renderLayer: RENDER_ORDER[entityType],
        });
        await ec.avatar.loadFromMetadata(
            await Assets.load(morphology.avatar),
            entityId,
        );
        ec.avatar.animationManager.load(
            await Assets.load(morphology.animation),
        );
        entityContainers[entityId] = ec;

        // Set size
        const { width, height, scale } = scaleToFitAndMaintainAspectRatio(
            ec.width,
            ec.height,
            ISO_CELL_WIDTH * 1, // max width is 1 cell
            ISO_CELL_HEIGHT * 3, // max height is 3 cells
        );
        ec.scale.x = scale;
        ec.scale.y = scale;

        // Set initial pose
        await ec.avatar.pose(ec.avatar.animationManager.getPose("default"));

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
            zOffset: Z_OFF.entity,
            zScale: Z_SCALE,
            renderLayer: RENDER_ORDER[entityType],
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
            const variant = prop.states[item.state].variant;
            await ec.loadAsset(asset, { variant });
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

async function upsertEntityContainer(
    entity: Player | Item | Monster,
    stage: Container,
): Promise<[boolean, SimpleEntityContainer | AvatarEntityContainer]> {
    if (entity.locT !== "geohash") {
        throw new Error("entity location is not a geohash");
    }

    const [entityId, entityType] = getEntityId(entity);

    // Get position
    const position = await calculatePosition(entity.loc[0]);
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
        ec.updateIsoPosition(position);
    }
    // Update position
    else {
        if (entityType == "player" || entityType == "monster") {
            const { pthclk, pthdur } = entity as PathParams;
            // Entity is moving
            if (pthclk + pthdur > Date.now()) {
                await ec.followPath(entity as PathParams);
            } else {
                ec.updateIsoPosition(position);
            }
        } else {
            ec.updateIsoPosition(
                position,
                tween ? (actions.move.ticks * MS_PER_TICK) / 1000 : undefined,
            );
        }
    }

    return [created, ec];
}

/**
 * Only manually cull (destroy) entities if they are very far away
 *
 * @param playerPosition - The player's position, if undefined, cull all entities
 */
function cullEntityContainers(playerPosition?: Position) {
    if (playerPosition == null) {
        for (const [id, ec] of Object.entries(entityContainers)) {
            ec.destroy();
            delete entityContainers[id];
        }
    } else {
        const p5s = geohashesNearby(playerPosition.geohash.slice(0, -2));
        for (const [id, ec] of Object.entries(entityContainers)) {
            const geohash = ec.isoPosition?.geohash;
            if (geohash != null && !p5s.some((gh) => geohash.startsWith(gh))) {
                ec.destroy();
                delete entityContainers[id];
            }
        }
    }
}

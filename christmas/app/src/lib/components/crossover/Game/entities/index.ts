import { getEntityId } from "$lib/crossover/utils";
import { actions } from "$lib/crossover/world/actions";
import { avatarMorphologies, bestiary } from "$lib/crossover/world/bestiary";
import { compendium } from "$lib/crossover/world/compendium";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import type {
    EntityType,
    Item,
    Monster,
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
    playerPosition: Position,
    entityType: EntityType,
    stage: Container,
) {
    // Upsert entities (only locT = geohash)
    let upserted = new Set<string>();
    for (const entity of Object.values(er)) {
        if (entity.locT === "geohash") {
            await upsertEntityContainer(entity, playerPosition, stage);
            upserted.add(getEntityId(entity)[0]);
        }
    }

    // Destroy entities not in record
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
    position: Position,
    stage: Container,
) {
    const [entityId, entityType] = getEntityId(entity);
    let avatarContainer = entityContainers[entityId];

    // Create
    if (avatarContainer == null) {
        const morphology = avatarMorphologies["humanoid"]; // TODO: get from bestiary

        avatarContainer = new AvatarEntityContainer({
            entity,
            zOffset: Z_OFF.entity,
            zScale: Z_SCALE,
            renderLayer: RENDER_ORDER[entityType],
        });
        await avatarContainer.loadFromMetadata(
            await Assets.load(morphology.avatar),
        );
        avatarContainer.animationManager.load(
            await Assets.load(morphology.animation),
        );
        entityContainers[entityId] = avatarContainer;

        // Set size
        const [width, height] = scaleToFitAndMaintainAspectRatio(
            avatarContainer.width,
            avatarContainer.height,
            ISO_CELL_WIDTH * 4,
            ISO_CELL_HEIGHT * 8,
        );
        avatarContainer.width = width;
        avatarContainer.height = height;
        avatarContainer.pivot = { x: width / 2, y: height };

        // Set initial pose
        await avatarContainer.pose(
            avatarContainer.animationManager.getPose("default"),
        );
    }

    // Add to stage (might have been culled)
    if (!stage.children.includes(avatarContainer)) {
        stage.addChild(avatarContainer);
    }

    // Move avatar
    avatarContainer.updateIsoPosition(
        position,
        (actions.move.ticks * MS_PER_TICK) / 1000,
    );
}

async function upsertSimpleContainer(
    entity: Monster | Item,
    position: Position,
    stage: Container,
) {
    const [entityId, entityType] = getEntityId(entity);
    let ec = entityContainers[entityId];

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

        // Load asset
        if (entityType === "monster") {
            const monster = entity as Monster;
            const asset = bestiary[monster.beast].asset;
            await ec.loadAsset(asset, { anchor: { x: 0.5, y: 1 } });
        } else if (entityType === "item") {
            const item = entity as Item;
            const prop = compendium[item.prop];
            const asset = prop.asset;
            const variant = prop.states[item.state].variant;
            await ec.loadAsset(asset, { variant });
        }

        // Set initial position
        ec.updateIsoPosition(position);

        // Set event listeners
        ec.eventMode = "static";
        ec.interactiveChildren = false; // Prevents mouse events from bubbling to children
        ec.hitArea = ec.getBounds(true).rectangle;
        ec.onmouseover = () => onMouseOverEntity(ec.entityId);
        ec.onmouseleave = () => onMouseLeaveEntity(ec.entityId);
        ec.onclick = () => onClickEntity(ec.entity);
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

        // Tween position
        ec.updateIsoPosition(
            position,
            (actions.move.ticks * MS_PER_TICK) / 1000,
        );
    }

    // Add to stage (might have been culled)
    if (!stage.children.includes(ec)) {
        stage.addChild(ec);
    }
}

async function upsertEntityContainer(
    entity: Player | Item | Monster,
    playerPosition: Position,
    stage: Container,
) {
    if (entity.locT !== "geohash") {
        return;
    }

    const [entityId, entityType] = getEntityId(entity);

    // Get position
    const position = await calculatePosition(entity.loc[0]);
    const { row, col, isoX, isoY, elevation } = position;

    // Ignore entities outside player's view
    if (!isCellInView({ row, col }, playerPosition)) {
        return;
    }

    // Upsert
    if (entityType === "player") {
        await upsertAvatarContainer(entity as Player, position, stage);
    } else {
        await upsertSimpleContainer(entity as Monster | Item, position, stage);
    }
}

function cullEntityContainers(playerPosition: Position, stage: Container) {
    // Cull entity containers outside view
    for (const [id, ec] of Object.entries(entityContainers)) {
        if (
            ec.isoPosition != null &&
            !isCellInView(ec.isoPosition, playerPosition)
        ) {
            ec.destroy();
            delete entityContainers[id];
        }
    }
}

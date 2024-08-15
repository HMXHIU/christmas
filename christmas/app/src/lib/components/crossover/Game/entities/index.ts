import {
    geohashesNearby,
    getEntityId,
    isEntityInMotion,
} from "$lib/crossover/utils";
import type { Attributes } from "$lib/crossover/world/abilities";
import { actions } from "$lib/crossover/world/actions";
import { monsterStats } from "$lib/crossover/world/bestiary";
import { playerStats } from "$lib/crossover/world/player";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import { bestiary } from "$lib/crossover/world/settings/bestiary";
import { compendium } from "$lib/crossover/world/settings/compendium";
import type {
    Item,
    Monster,
    PathParams,
    Player,
} from "$lib/server/crossover/redis/entities";
import { AsyncLock } from "$lib/utils";
import { Container } from "pixi.js";
import { get } from "svelte/store";
import { player, target } from "../../../../../store";
import {
    calculatePosition,
    getAvatarMetadata,
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
    attributes?: Attributes,
): Promise<EntitySigil> {
    const entity = ec.entity as Monster | Player;

    // Check if already exists
    if (entitySigils[ec.entityId]) {
        entitySigils[ec.entityId].updateStats(entity);
        return entitySigils[ec.entityId];
    }

    // Create
    let maxStats =
        ec.entityType === "player"
            ? playerStats({
                  level: entity.lvl,
                  attributes: attributes,
              })
            : monsterStats({
                  level: entity.lvl,
                  beast: (entity as Monster).beast,
              });

    const sigil = new EntitySigil(ec, maxStats, entity, {
        anchor: { x: 0, y: -0.825 },
        radius: 48,
    });
    entitySigils[ec.entityId] = sigil;
    stage.addChild(sigil);
    return entitySigils[ec.entityId];
}

const upsertEntityContainerLock = new AsyncLock();
async function upsertEntityContainer(
    entity: Player | Item | Monster,
    stage: Container,
): Promise<[boolean, SimpleEntityContainer | AvatarEntityContainer]> {
    return upsertEntityContainerLock.withLock(async () => {
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

            stage.addChild(ec.debugBoundingBox());
            ec.debugOrigin();
        }

        // Update position
        else {
            if (entityType == "player" || entityType == "monster") {
                // Entity is moving
                if (isEntityInMotion(entity as Player | Monster)) {
                    await ec.followPath(entity as PathParams);
                } else {
                    ec.updateIsoPosition(position);
                }
            } else {
                ec.updateIsoPosition(
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
            zOffset: Z_OFF.entity,
            zScale: Z_SCALE,
            renderLayer: RENDER_ORDER[entityType],
        });
        await ec.avatar.loadFromMetadata(avatar, entityId);
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

            // Set size pf dropped equipment
            if (prop.equipmentSlot != null) {
                const { width, height, scale } =
                    scaleToFitAndMaintainAspectRatio(
                        ec.width,
                        ec.height,
                        ISO_CELL_WIDTH * (asset.width ?? 1),
                        ISO_CELL_HEIGHT * (asset.height ?? 1),
                    );
                ec.scale.x = scale;
                ec.scale.y = scale;
            }
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
        if (geohash) {
            // Very far away
            if (!p5s.some((gh) => geohash.startsWith(gh))) {
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

function onClickEntity(entity: Player | Item | Monster) {
    // Set target
    target.set(entity);
}

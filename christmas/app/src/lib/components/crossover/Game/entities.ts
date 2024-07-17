import { Avatar } from "$avatar/Avatar";
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
import gsap from "gsap";
import {
    Assets,
    Container,
    Geometry,
    Graphics,
    Mesh,
    Rectangle,
    Shader,
    Sprite,
    Texture,
} from "pixi.js";
import { get } from "svelte/store";
import { player, target } from "../../../../store";
import { loadShaderGeometry } from "../shaders";
import { clearHighlights, highlightEntity } from "./ui";
import {
    calculatePosition,
    CELL_WIDTH,
    destroyContainer,
    isCellInView,
    ISO_CELL_HEIGHT,
    ISO_CELL_WIDTH,
    loadAssetTexture,
    scaleToFitAndMaintainAspectRatio,
    swapEntityVariant,
    updateEntityMeshRenderOrder,
    Z_OFF,
    Z_SCALE,
    type EntityMesh,
    type Position,
} from "./utils";

export {
    cullEntityMeshes,
    destroyEntityMesh,
    entityMeshes,
    updateEntities,
    upsertEntityMesh,
};

let entityMeshes: Record<string, EntityMesh> = {};
let entityAvatars: Record<string, Avatar> = {};

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
            await upsertEntityMesh(entity, playerPosition, stage);
            upserted.add(getEntityId(entity)[0]);
        }
    }

    // Destroy entities not in record
    const self = get(player);
    for (const [id, entityMesh] of Object.entries(entityMeshes)) {
        if (
            entityMesh.entity == null ||
            self == null ||
            id === self.player ||
            upserted.has(id) ||
            getEntityId(entityMesh.entity)[1] !== entityType
        ) {
            continue;
        }
        destroyEntityMesh(entityMesh, stage);
        delete entityMeshes[id];
    }
}

function onMouseOverEntity(entityId: string) {
    const entityMesh = entityMeshes[entityId];
    const t = get(target);

    // Highlight if entity is not target (already highlighted)
    if ((t == null || getEntityId(t)[0] != entityId) && entityMesh != null) {
        highlightEntity(entityMesh, 1);
    }
}

function onMouseLeaveEntity(entityId: string) {
    // Clear highlight if entity is not target
    const entityMesh = entityMeshes[entityId];
    const t = get(target);
    if ((t == null || getEntityId(t)[0] != entityId) && entityMesh != null) {
        clearHighlights(entityMesh);
    }
}

function onClickEntity(entity: Player | Item | Monster) {
    // Set target
    target.set(entity);
}

async function upsertEntityAvatar(
    entity: Player | Monster,
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

    let avatar = entityAvatars[entityId];

    // Create
    if (avatar == null) {
        const morphology = "humanoid";
        const morphologySource = avatarMorphologies[morphology];
        avatar = new Avatar();
        await avatar.loadFromMetadata(
            await Assets.load(morphologySource.avatar),
        );
        avatar.animationManager.load(
            await Assets.load(morphologySource.animation),
        );
        entityAvatars[entityId] = avatar;

        // Set size
        const [width, height] = scaleToFitAndMaintainAspectRatio(
            avatar.width,
            avatar.height,
            ISO_CELL_WIDTH * 4,
            ISO_CELL_HEIGHT * 8,
        );
        avatar.width = width;
        avatar.height = height;

        await avatar.pose(avatar.animationManager.getPose("default"));
    }

    // Add to stage (might have been culled)
    if (!stage.children.includes(avatar)) {
        stage.addChild(avatar);
    }

    // Tween position
    gsap.to(avatar, {
        x: isoX,
        y: isoY - elevation,
        duration: (actions.move.ticks * MS_PER_TICK) / 1000,
    });
}

async function upsertEntityMesh(
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

    // // FOR TESTING
    // if (entityType === "player") {
    //     await upsertEntityAvatar(entity as Player, playerPosition, stage);
    //     return;
    // }

    // Update
    let entityMesh = entityMeshes[entityId];
    if (entityMesh != null) {
        if (entityType === "player") {
        } else if (entityType === "monster") {
        } else if (entityType === "item") {
            const item = entity as Item;
            const prop = compendium[item.prop];
            const variant = prop.states[item.state].variant;
            await swapEntityVariant(entityMesh, variant);
        }

        // Update
        const instancePositions =
            entityMesh.shaderGeometry.geometry.getBuffer("aInstancePosition");
        instancePositions.data.set([isoX, isoY, elevation]);
        instancePositions.update();
        entityMesh.position = position;

        // Tween position
        gsap.to(entityMesh.hitbox, {
            x: isoX,
            y: isoY - elevation,
            duration: (actions.move.ticks * MS_PER_TICK) / 1000,
        });

        // Set render order
        updateEntityMeshRenderOrder(entityMesh);

        // Add to worldStage (might have been culled)
        if (!stage.children.includes(entityMesh.hitbox)) {
            stage.addChild(entityMesh.hitbox);
        }
    }
    // Create
    else {
        let texture: Texture | null = null;
        let width: number = 0;
        let anchor: { x: number; y: number } = { x: 0.5, y: 0.5 };
        let variant: string | null = null;

        // Get texture, variant, width, anchor
        if (entityType === "player") {
            texture = await Assets.load((entity as Player).avatar);
            width = CELL_WIDTH;
            anchor = { x: 0.5, y: 1 };
        } else if (entityType === "monster") {
            const monster = entity as Monster;
            const asset = bestiary[monster.beast]?.asset;
            texture = await loadAssetTexture(asset);
            width = asset.width * CELL_WIDTH; // asset.width is the multiplier
            anchor = { x: 0.5, y: 1 };
        } else if (entityType === "item") {
            const item = entity as Item;
            const prop = compendium[item.prop];
            const asset = prop?.asset;
            variant = prop.states[item.state].variant;
            width = asset.width * CELL_WIDTH; // asset.width is the multiplier
            texture = await loadAssetTexture(asset, { variant });
        }
        if (!texture) {
            console.log(`Missing texture for ${entity.name}`);
            return;
        }

        // Create entity mesh
        const height = (texture.height * width) / texture.width; // Scale height while maintaining aspect ratio
        const shaderGeometry = loadShaderGeometry(
            "entity",
            texture,
            width,
            height,
            {
                uid: entityId,
                anchor,
                zScale: Z_SCALE,
                zOffset: Z_OFF.entity,
            },
        );

        const mesh = new Mesh<Geometry, Shader>({
            geometry: shaderGeometry.geometry,
            shader: shaderGeometry.shader,
        });

        // Create a hitbox for cursor events (can't use the mesh directly because the position is set in shaders)
        const hitbox = new Container({
            width: width,
            height: height,
            x: isoX,
            y: isoY - elevation,
            pivot: {
                x: anchor.x * width,
                y: anchor.y * height,
            },
            eventMode: "static",
            hitArea: new Rectangle(0, 0, width, height),
            onmouseover: () => onMouseOverEntity(entityId),
            onmouseleave: () => onMouseLeaveEntity(entityId),
            onclick: () => onClickEntity(entity),
        });
        hitbox.addChild(mesh);

        // Create entity mesh
        entityMesh = {
            id: entityId,
            mesh,
            shaderGeometry,
            hitbox,
            entity,
            position,
        };

        // Set initial position (entities only use instancePositions for calculuation z)
        const instancePositions =
            entityMesh.shaderGeometry.geometry.getBuffer("aInstancePosition");
        instancePositions.data.set([isoX, isoY, elevation]);
        instancePositions.update();

        // Set mesh properties
        if (variant != null) {
            entityMesh.properties = { variant };
        }

        // Create action icon (sprite)
        if (entityType === "player" || entityType === "monster") {
            // Default move icon (to get dimensions)
            const [bundleName, alias] = actions.move.icon.path
                .split("/")
                .slice(-2);
            const bundle = await Assets.loadBundle(bundleName);
            const texture: Texture =
                bundle[alias].textures[actions.move.icon.icon];

            const icon = new Sprite({
                texture: Texture.EMPTY,
                visible: false,
                height: texture.height,
                width: texture.width,
                anchor: { x: 0.5, y: 0.5 },
                position: {
                    x: hitbox.width / 2,
                    y: -0.5 * ISO_CELL_HEIGHT,
                },
            });

            // Create a circular mask
            const mask = new Graphics();
            mask.circle(0, 0, Math.max(icon.width, icon.height) / 2);
            mask.fill({ color: 0xffffff });
            mask.position = { x: icon.width / 2, y: icon.height / 2 };
            mask.pivot = { x: icon.width / 2, y: icon.height / 2 };

            // Apply mask
            icon.mask = mask;
            icon.addChild(mask);

            // Set icon position to bottom of hitbox
            entityMesh.actionIcon = icon;
            hitbox.addChild(icon);
        }

        entityMeshes[entityId] = entityMesh;

        // Set render order
        updateEntityMeshRenderOrder(entityMesh);

        // Add to stage (might have been culled)
        if (!stage.children.includes(entityMesh.hitbox)) {
            stage.addChild(entityMesh.hitbox);
        }
    }
}

function cullEntityMeshes(playerPosition: Position, stage: Container) {
    // Cull entity meshes outside view
    for (const [id, entityMesh] of Object.entries(entityMeshes)) {
        if (!isCellInView(entityMesh.position, playerPosition)) {
            destroyEntityMesh(entityMesh, stage);
            delete entityMeshes[id];
        }
    }
}

function destroyEntityMesh(entityMesh: EntityMesh, stage: Container) {
    // Destroy hitbox and children
    destroyContainer(entityMesh.hitbox);

    // TODO: causes mesh has no shader program
    // Destroy shader geometry
    // destroyShaderGeometry(entityMesh.shaderGeometry.shaderUid);
}

<script lang="ts">
    import { crossoverCmdMove } from "$lib/crossover";
    import {
        autoCorrectGeohashPrecision,
        cartToIso,
        getEntityId,
        getPositionsForPath,
        snapToGrid,
    } from "$lib/crossover/utils";
    import { abilities, type Ability } from "$lib/crossover/world/abilities";
    import { actions, type Action } from "$lib/crossover/world/actions";
    import { bestiary } from "$lib/crossover/world/bestiary";
    import { compendium, type Utility } from "$lib/crossover/world/compendium";
    import { MS_PER_TICK } from "$lib/crossover/world/settings";
    import type { Direction } from "$lib/crossover/world/types";
    import { worldSeed } from "$lib/crossover/world/world";

    import { getGameActionId, type GameCommand } from "$lib/crossover/ir";
    import type {
        EntityType,
        Item,
        Monster,
        Player,
        World,
    } from "$lib/server/crossover/redis/entities";
    import { cn } from "$lib/shadcn";
    import { gsap } from "gsap";
    import PixiPlugin from "gsap/PixiPlugin";
    import {
        Application,
        Assets,
        Container,
        FederatedMouseEvent,
        Geometry,
        Mesh,
        Rectangle,
        Shader,
        Texture,
        Ticker,
        WebGLRenderer,
    } from "pixi.js";
    import { onDestroy, onMount } from "svelte";
    import type { ActionEvent } from "../../../../routes/api/crossover/stream/+server";
    import {
        itemRecord,
        monsterRecord,
        player,
        playerRecord,
        target,
        worldRecord,
    } from "../../../../store";
    import {
        MAX_SHADER_GEOMETRIES,
        destroyShaders,
        loadShaderGeometry,
        updateShaderUniforms,
    } from "./shaders";
    import {
        CANVAS_HEIGHT,
        CANVAS_WIDTH,
        CELL_HEIGHT,
        CELL_WIDTH,
        GRID_MID_COL,
        GRID_MID_ROW,
        HALF_ISO_CELL_HEIGHT,
        HALF_ISO_CELL_WIDTH,
        ISO_CELL_HEIGHT,
        RENDER_ORDER,
        WORLD_HEIGHT,
        WORLD_WIDTH,
        Z_OFF,
        Z_SCALE,
        animateSlash,
        calculateBiomeDecorationsForRowCol,
        calculateBiomeForRowCol,
        calculatePosition,
        clearInstancedShaderMeshes,
        destroyEntityMesh,
        drawShaderTextures,
        getDirectionsToPosition,
        getImageForTile,
        getTilesetForTile,
        highlightShaderInstances,
        initAssetManager,
        isCellInView,
        loadAssetTexture,
        positionsInRange,
        swapEntityVariant,
        swapMeshTexture,
        updateEntityMeshRenderOrder,
        type EntityMesh,
        type Position,
        type ShaderTexture,
    } from "./utils";

    export let previewCommand: GameCommand | null = null;

    let container: HTMLDivElement;
    let isInitialized = false;
    let clientWidth: number;
    let clientHeight: number;
    let app: Application | null = null;
    let worldStage: Container | null = null;

    let biomeTexturePositions: Record<string, ShaderTexture> = {};
    let biomeDecorationsTexturePositions: Record<string, ShaderTexture> = {};

    let entityMeshes: Record<string, EntityMesh> = {};
    let worldMeshes: Record<string, EntityMesh> = {};

    let playerPosition: Position | null = null;
    let lastCursorX: number = 0;
    let lastCursorY: number = 0;
    let isMouseDown: boolean = false;
    let path: Direction[] | null = null;

    $: updatePlayer(playerPosition);
    $: updateBiomes(playerPosition);
    $: resize(clientHeight, clientWidth);
    $: handlePreviewCommand(previewCommand);

    async function handlePreviewCommand(command: GameCommand | null) {
        if (
            !isInitialized ||
            playerPosition == null ||
            worldStage == null ||
            app == null
        ) {
            return;
        }
        if (command == null) {
            // Clear highlights
            highlightShaderInstances("biome", {});
            return;
        }

        const [ga, { self, target, item }] = command;
        const [gaId, gaType] = getGameActionId(ga);

        // Highlight target
        if (target != null) {
            const targetEntityId = getEntityId(target)[0];
            const targetEntityMesh = entityMeshes[targetEntityId];
            if (targetEntityMesh != null) {
                highlightTarget(target, 2);
            }

            /**
             * Test attack trail
             */

            const startX = playerPosition.isoX;
            const startY = playerPosition.isoY - playerPosition.elevation;
            const endX = targetEntityMesh.position.isoX;
            const endY =
                targetEntityMesh.position.isoY -
                targetEntityMesh.position.elevation;

            animateSlash(worldStage, startX, startY, endX, endY);

            ////////////////////////

            // TODO: Draw line to target
            // const startX = playerPosition.isoX;
            // const startY =
            //     playerPosition.isoY - playerPosition.elevation;
            // const endX = targetEntityMesh.position.isoX;
            // const endY =
            //     targetEntityMesh.position.isoY -
            //     targetEntityMesh.position.elevation;
            // const line = new Graphics();
            // line.zIndex = 10000;
            // line.moveTo(startX, startY);
            // line.lineTo(endX, endY);
            // line.stroke({ width: 4, color: 0xffd900 });
            // worldStage.addChild(line);
        }

        if (gaType === "ability") {
            const ability = ga as Ability;
            // Highlight cells in range
            highlightShaderInstances(
                "biome",
                positionsInRange(ability, playerPosition),
            );
        } else if (gaType === "utility") {
            const utility = ga as Utility;
        } else if (gaType === "action") {
            const action = ga as Action;
            // Highlight cells in range
            highlightShaderInstances(
                "biome",
                positionsInRange(action, playerPosition),
            );
        }
    }

    function updatePlayerPosition(player: Player | null) {
        if (player == null) {
            return;
        }
        calculatePosition(player.loc[0]).then((p) => {
            playerPosition = p;
        });
    }

    function updateCamera(player: Player, tween = true) {
        if (playerPosition != null && worldStage != null) {
            const offsetX =
                playerPosition.isoX + CELL_WIDTH / 2 - clientWidth / 2;
            const offsetY =
                playerPosition.isoY -
                playerPosition.elevation -
                clientHeight / 2;
            if (tween) {
                const t = gsap.to(worldStage.pivot, {
                    x: offsetX,
                    y: offsetY,
                    duration: 1,
                    ease: "power2.out",
                });
            } else {
                worldStage.pivot = { x: offsetX, y: offsetY };
            }
        }
    }

    function resize(clientHeight: number, clientWidth: number) {
        if (app && isInitialized && clientHeight && clientWidth && $player) {
            app.renderer.resize(clientWidth, clientHeight);
            updateCamera($player);
        }
    }

    function highlightTarget(
        target: Player | Monster | Item | null,
        highlight: number = 1,
    ) {
        if (target == null) {
            return;
        }
        const [targetEntityId, entityType] = getEntityId(target);

        // Highlight target entity and unhighlight others
        for (const [entityId, { shaderGeometry }] of Object.entries(
            entityMeshes,
        )) {
            if (entityId === targetEntityId) {
                shaderGeometry.instanceHighlights.data.fill(highlight);
            } else {
                shaderGeometry.instanceHighlights.data.fill(0);
            }
            shaderGeometry.instanceHighlights.update();
        }
    }

    export async function drawActionEvent(event: ActionEvent) {
        /**
         * TODO: Server should notify entity perform action on entity to all clients involved for rendering
         */
        if (!isInitialized || worldStage == null) {
            return;
        }
        const { source, target, action, ability, utility, prop } = event;

        // Get source entity
        const sourceEntity = entityMeshes[source];
        const targetEntity = target ? entityMeshes[target] : null;

        // Render action/ability/utility
        if (action != null && sourceEntity != null) {
            const { ticks, icon } = actions[action];
            // Show action icon for duration
            const [bundleName, alias] = icon.path.split("/").slice(-2);
            const bundle = await Assets.loadBundle(bundleName);
            const texture = bundle[alias].textures[icon.icon];
            if (sourceEntity.actionIcon != null) {
                swapMeshTexture(sourceEntity.actionIcon, texture);
                sourceEntity.actionIcon.visible = true;
                setTimeout(
                    () => {
                        if (sourceEntity.actionIcon != null) {
                            sourceEntity.actionIcon.visible = false;
                        }
                    },
                    Math.max(ticks * MS_PER_TICK, 1000),
                );
            }
            console.log(source, "performing action on", target);
        } else if (ability != null) {
            const abilityRecord = abilities[ability];
            console.log(source, "performing ability on", target);
        } else if (
            utility != null &&
            prop != null &&
            compendium[prop]?.utilities[utility] != null
        ) {
            const utilityRecord = compendium[prop]?.utilities[utility];
            console.log(source, "performing utility on", target);
        }
    }

    async function updateWorlds(
        worldRecord: Record<string, Record<string, World>>,
        playerPosition: Position | null,
    ) {
        if (!isInitialized || playerPosition == null) {
            return;
        }

        // Get all worlds in town
        const town = playerPosition.geohash.slice(
            0,
            worldSeed.spatial.town.precision,
        );
        const worlds = worldRecord[town];
        if (!worlds) {
            return;
        }

        // TODO: this is pretty inefficient we we need to keep loading everytime player moves

        // Load worlds
        for (const w of Object.values(worlds)) {
            const origin = autoCorrectGeohashPrecision(
                w.loc[0],
                worldSeed.spatial.unit.precision,
            );
            await loadWorld({
                world: w,
                position: await calculatePosition(origin),
                town,
            });
        }
    }

    async function updateBiomes(playerPosition: Position | null) {
        if (
            !isInitialized ||
            playerPosition == null ||
            $player == null ||
            worldStage == null
        ) {
            return;
        }

        // Clear shader textures
        biomeTexturePositions = {};
        biomeDecorationsTexturePositions = {};

        // Create biome shader instances
        for (
            let row = playerPosition.row - GRID_MID_ROW;
            row < playerPosition.row + GRID_MID_ROW;
            row++
        ) {
            for (
                let col = playerPosition.col - GRID_MID_COL;
                col < playerPosition.col + GRID_MID_COL;
                col++
            ) {
                // Fill biomeTexturePositions
                const {
                    isoX,
                    isoY,
                    texture,
                    elevation,
                    biome,
                    geohash,
                    strength,
                    width,
                    height,
                } = await calculateBiomeForRowCol(playerPosition, row, col);

                if (biomeTexturePositions[texture.uid] == null) {
                    biomeTexturePositions[texture.uid] = {
                        texture,
                        positions: new Float32Array(
                            MAX_SHADER_GEOMETRIES * 3,
                        ).fill(-1), // x, y, h
                        width,
                        height,
                        length: 0,
                    };
                } else {
                    biomeTexturePositions[texture.uid].positions![
                        biomeTexturePositions[texture.uid].length
                    ] = isoX;
                    biomeTexturePositions[texture.uid].positions![
                        biomeTexturePositions[texture.uid].length + 1
                    ] = isoY;
                    biomeTexturePositions[texture.uid].positions![
                        biomeTexturePositions[texture.uid].length + 2
                    ] = elevation;
                    biomeTexturePositions[texture.uid].length += 3;
                }

                // Fill biomeDecorationsTexturePositions
                for (const [
                    textureUid,
                    { positions, texture, height, width, length },
                ] of Object.entries(
                    await calculateBiomeDecorationsForRowCol({
                        geohash,
                        biome,
                        strength,
                        row,
                        col,
                        isoX,
                        isoY,
                        elevation,
                    }),
                )) {
                    if (biomeDecorationsTexturePositions[textureUid] == null) {
                        biomeDecorationsTexturePositions[textureUid] = {
                            texture,
                            positions: new Float32Array(
                                MAX_SHADER_GEOMETRIES * 3,
                            ).fill(-1), // x, y, h
                            width,
                            height,
                            length: 0,
                        };
                    } else {
                        biomeDecorationsTexturePositions[
                            textureUid
                        ].positions!.set(
                            positions!.subarray(0, length),
                            biomeDecorationsTexturePositions[textureUid].length,
                        );
                        biomeDecorationsTexturePositions[textureUid].length +=
                            length;
                    }
                }
            }
        }

        // Draw shaders
        drawShaderTextures({
            shaderName: "biome",
            shaderTextures: biomeTexturePositions,
            renderOrder: RENDER_ORDER.biome * playerPosition.isoY,
            numGeometries: MAX_SHADER_GEOMETRIES,
            stage: worldStage,
        });
        drawShaderTextures({
            shaderName: "grass",
            shaderTextures: biomeDecorationsTexturePositions,
            renderOrder: RENDER_ORDER.grass * playerPosition.isoY,
            numGeometries: MAX_SHADER_GEOMETRIES,
            stage: worldStage,
        });
    }

    async function loadWorld({
        world,
        position,
        town,
    }: {
        world: World;
        town: string;
        position: Position;
    }) {
        if (!isInitialized || worldStage == null) {
            return;
        }

        // await debugColliders(worldStage, $worldRecord);

        const tilemap = await Assets.load(world.url);
        const { layers, tilesets, tileheight, tilewidth } = tilemap;
        const [tileOffsetX, tileOffsetY] = cartToIso(
            tilewidth / 2,
            tilewidth / 2,
        );

        for (const layer of layers) {
            const {
                data, // 1D array of tile indices
                properties,
                offsetx, // in pixels
                offsety,
                width, // in tiles (1 tile might be multiple cells)
                height,
                x,
                y,
            } = layer;
            const props: { name: string; value: any; type: string }[] =
                properties ?? [];

            // Get properties
            const { z, collider, interior } = props.reduce(
                (acc: Record<string, any>, { name, value, type }) => {
                    acc[name] = value;
                    return acc;
                },
                {},
            );

            const sortedTilesets = tilesets
                .sort((a: any, b: any) => a.firstgid - b.firstgid)
                .reverse();

            // Create tile sprites
            for (let i = 0; i < height; i++) {
                for (let j = 0; j < width; j++) {
                    const tileId = data[i * width + j];
                    if (tileId === 0) {
                        continue;
                    }
                    const id = `${town}-${world.world}-${tileId}-${i}-${j}`;

                    // Skip if already created
                    if (id in worldMeshes) {
                        continue;
                    }

                    // Get tileset for tileId
                    const { tileset, firstgid } = await getTilesetForTile(
                        tileId,
                        sortedTilesets,
                    );

                    // Get image for tileId
                    const { texture, imageheight, imagewidth } =
                        await getImageForTile(tileset.tiles, tileId - firstgid);

                    const [isoX, isoY] = cartToIso(
                        j * tilewidth,
                        i * tilewidth, // use tilewidth for cartesian
                    );

                    const shaderGeometry = loadShaderGeometry(
                        "world",
                        texture,
                        imagewidth,
                        imageheight,
                        {
                            // Note: anchor is not used in entity meshes shader
                            uid: id,
                            zScale: Z_SCALE,
                            zOffset: Z_OFF[z] ?? Z_OFF.floor,
                            cellHeight: tileheight / ISO_CELL_HEIGHT,
                        },
                    );

                    const mesh = new Mesh<Geometry, Shader>({
                        geometry: shaderGeometry.geometry,
                        shader: shaderGeometry.shader,
                    });

                    // Center of the bottom tile (imageheight a multiple of tileheight)
                    const anchor = {
                        x: 0.5,
                        y: 1 - tileheight / imageheight / 2,
                    };

                    // Set initial position
                    const x =
                        isoX +
                        (offsetx ?? 0) +
                        position.isoX +
                        tileOffsetX -
                        anchor.x * imagewidth;
                    const y =
                        isoY +
                        (offsety ?? 0) +
                        position.isoY +
                        tileOffsetY -
                        anchor.y * imageheight;
                    mesh.x = x;
                    mesh.y = y - position.elevation;
                    mesh.zIndex = RENDER_ORDER[z] || RENDER_ORDER.world;
                    shaderGeometry.instancePositions.data.set([
                        x,
                        y + imageheight, // this is only used to calculate z
                        position.elevation, // this is not used to calculate z
                    ]);
                    shaderGeometry.instancePositions.update();

                    // Add to worldMeshes
                    const worldMesh = {
                        id,
                        mesh,
                        shaderGeometry,
                        hitbox: new Container(), // Not used for world meshes
                        position: position, // Not used for world meshes
                    };

                    worldMeshes[id] = worldMesh;

                    // Add to worldStage
                    if (!worldStage.children.includes(mesh)) {
                        worldStage.addChild(mesh);
                    }
                }
            }
        }
    }

    async function updatePlayer(playerPosition: Position | null) {
        if (
            !isInitialized ||
            playerPosition == null ||
            worldStage == null ||
            $player == null
        ) {
            return;
        }

        // Cull entity meshes outside view
        for (const [id, entityMesh] of Object.entries(entityMeshes)) {
            if (!isCellInView(entityMesh.position, playerPosition)) {
                destroyEntityMesh(entityMesh, worldStage);
                delete entityMeshes[id];
            }
        }

        // Cull world meshes outside town
        const town = playerPosition.geohash.slice(
            0,
            worldSeed.spatial.town.precision,
        );
        for (const [id, entityMesh] of Object.entries(worldMeshes)) {
            if (!id.startsWith(town)) {
                destroyEntityMesh(entityMesh, worldStage);
                delete worldMeshes[id];
            }
        }

        // Player
        const playerMesh = entityMeshes[$player.player];
        if (playerMesh != null && playerMesh.mesh != null) {
            // Update
            playerMesh.shaderGeometry.instancePositions.data.set([
                playerPosition.isoX,
                playerPosition.isoY,
                playerPosition.elevation,
            ]);
            playerMesh.shaderGeometry.instancePositions.update();
            playerMesh.position = playerPosition;

            // Tween position
            gsap.to(playerMesh.hitbox, {
                x: playerPosition.isoX,
                y: playerPosition.isoY - playerPosition.elevation,
                duration: (actions.move.ticks * MS_PER_TICK) / 1000,
            });

            // Set render order
            updateEntityMeshRenderOrder(playerMesh);
        }

        // Move camera to player
        updateCamera($player);
    }

    async function updateEntities(
        er: Record<string, Monster | Player | Item>,
        playerPosition: Position | null,
        entityType: EntityType,
    ) {
        if (
            !isInitialized ||
            playerPosition == null ||
            worldStage == null ||
            $player == null
        ) {
            return;
        }

        // Upsert entities (only locT = geohash)
        let upserted = new Set<string>();
        for (const entity of Object.values(er)) {
            if (entity.locT === "geohash") {
                await upsertEntityMesh(entity);
                upserted.add(getEntityId(entity)[0]);
            }
        }

        // Destroy entities not in record
        for (const [id, entityMesh] of Object.entries(entityMeshes)) {
            if (
                entityMesh.entity == null ||
                id === $player.player ||
                upserted.has(id) ||
                getEntityId(entityMesh.entity)[1] !== entityType
            ) {
                continue;
            }
            destroyEntityMesh(entityMesh, worldStage);
            delete entityMeshes[id];
        }
    }

    async function upsertEntityMesh(entity: Player | Item | Monster) {
        if (worldStage == null || playerPosition == null || $player == null) {
            return;
        }

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
            entityMesh.shaderGeometry.instancePositions.data.set([
                isoX,
                isoY,
                elevation,
            ]);
            entityMesh.shaderGeometry.instancePositions.update();
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
            if (!worldStage.children.includes(entityMesh.hitbox)) {
                worldStage.addChild(entityMesh.hitbox);
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
                onmouseover: () => {
                    shaderGeometry.instanceHighlights.data.fill(1);
                    shaderGeometry.instanceHighlights.update();
                },
                onmouseleave: () => {
                    if (
                        $target == null ||
                        getEntityId($target)[0] != entityId
                    ) {
                        shaderGeometry.instanceHighlights.data.fill(0);
                        shaderGeometry.instanceHighlights.update();
                    }
                },
                onclick: () => {
                    // Set target
                    target.set(entity);
                },
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
            entityMesh.shaderGeometry.instancePositions.data.set([
                isoX,
                isoY,
                elevation,
            ]);
            entityMesh.shaderGeometry.instancePositions.update();

            // Set mesh properties
            if (variant != null) {
                entityMesh.properties = { variant };
            }

            // Create action icon
            if (entityType === "player" || entityType === "monster") {
                const { shader, geometry } = loadShaderGeometry(
                    "icon",
                    Texture.EMPTY, // use texture swap to change icon
                    CELL_WIDTH / 2,
                    CELL_HEIGHT / 2,
                    {
                        uid: entityId, // use entityId as texture uid
                        zScale: Z_SCALE,
                        zOffset: Z_OFF.icon,
                    },
                );
                const iconMesh = new Mesh<Geometry, Shader>({
                    geometry,
                    shader,
                });
                iconMesh.visible = false; // hide by default

                // Set icon position to bottom of entity mesh
                hitbox.addChild(iconMesh);
                iconMesh.pivot.set(iconMesh.width / 2, iconMesh.height / 2);
                iconMesh.position.set(hitbox.width / 2, hitbox.height * 0.9);

                entityMesh.actionIcon = iconMesh;
            }

            entityMeshes[entityId] = entityMesh;

            // Set render order
            updateEntityMeshRenderOrder(entityMesh);

            // Add to worldStage (might have been culled)
            if (!worldStage.children.includes(entityMesh.hitbox)) {
                worldStage.addChild(entityMesh.hitbox);
            }
        }
    }

    function onMouseMove(x: number, y: number) {
        if (playerPosition == null) {
            return;
        }

        if (isMouseDown) {
            // Calculate path (astar)
            path = getDirectionsToPosition(playerPosition, { x, y });

            // Highlight path
            const highlights = Object.fromEntries(
                getPositionsForPath(
                    { row: playerPosition.row, col: playerPosition.col },
                    path,
                ).map(({ row, col }) => {
                    const [x, y] = cartToIso(
                        col * CELL_WIDTH,
                        row * CELL_HEIGHT,
                        {
                            x: HALF_ISO_CELL_WIDTH,
                            y: HALF_ISO_CELL_HEIGHT,
                        },
                    );
                    return [`${x},${y}`, 1];
                }),
            );
            highlightShaderInstances("biome", highlights);
        }
    }

    async function onMouseUp(x: number, y: number) {
        if (playerPosition == null) {
            return;
        }
        // Clear highlights
        highlightShaderInstances("biome", {});

        // Move command
        if (path != null && path.length > 0) {
            await crossoverCmdMove({ path });
        }
    }

    function onMouseDown(x: number, y: number) {
        if (playerPosition == null || worldStage == null) {
            return;
        }
        // Clear path
        path = null;
    }

    function ticker(ticker: Ticker) {
        if (!isInitialized || app == null || worldStage == null) {
            return;
        }

        // Clear depth buffer
        const gl = (app.renderer as WebGLRenderer).gl;
        gl.clearDepth(1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Update shader uniforms
        const seconds = ticker.elapsedMS / 1000;
        updateShaderUniforms({ deltaTime: seconds });
    }

    /*
     * Initialization
     */

    async function init() {
        if (isInitialized || app == null || worldStage == null) {
            return;
        }
        await app.init({
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            antialias: false,
            preference: "webgl",
        });
        await initAssetManager();

        // GSAP
        gsap.registerPlugin(PixiPlugin);

        // Set up depth test
        const gl = (app.renderer as WebGLRenderer).gl;
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.depthMask(true);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Add world container
        worldStage.width = WORLD_WIDTH;
        worldStage.height = WORLD_HEIGHT;
        app.stage.addChild(worldStage);

        // Setup app events
        app.stage.eventMode = "static"; // enable interactivity
        app.stage.hitArea = app.screen; // ensure whole canvas area is interactive

        console.log(app.screen);

        function getMousePosition(e: FederatedMouseEvent) {
            return snapToGrid(
                e.global.x + worldStage!.pivot.x,
                e.global.y + worldStage!.pivot.y + playerPosition!.elevation, // select on the same plane as player
                HALF_ISO_CELL_WIDTH,
                HALF_ISO_CELL_HEIGHT,
            );
        }
        app.stage.onmouseup = (e) => {
            if (playerPosition != null && e.global != null) {
                const [snapX, snapY] = getMousePosition(e);
                onMouseUp(snapX, snapY);
                lastCursorX = snapX;
                lastCursorY = snapY;
                isMouseDown = false;
            }
        };
        app.stage.onmousedown = (e) => {
            if (playerPosition != null && e.global != null) {
                const [snapX, snapY] = getMousePosition(e);
                onMouseDown(snapX, snapY);
                lastCursorX = snapX;
                lastCursorY = snapY;
                isMouseDown = true;
            }
        };
        app.stage.onmousemove = (e) => {
            if (playerPosition != null && e.global != null) {
                const [snapX, snapY] = getMousePosition(e);
                if (lastCursorX !== snapX || lastCursorY !== snapY) {
                    onMouseMove(snapX, snapY);
                    lastCursorX = snapX;
                    lastCursorY = snapY;
                }
            }
        };

        // Create player mesh
        if ($player) {
            await upsertEntityMesh($player);
        }

        // Add ticker
        app.ticker.add(ticker);

        // Add the canvas to the DOM
        container.appendChild(app.canvas);

        // Set initialized
        isInitialized = true;

        // Resize the canvas
        resize(clientHeight, clientWidth);

        // Initial update
        if (playerPosition && $player) {
            await updatePlayer(playerPosition);
            await updateBiomes(playerPosition);
            await updateEntities($monsterRecord, playerPosition, "monster");
            await updateEntities($playerRecord, playerPosition, "player");
            await updateEntities($itemRecord, playerPosition, "item");
            await updateWorlds($worldRecord, playerPosition);
            updateCamera($player, false);
        }
    }

    onMount(() => {
        app = new Application();
        worldStage = new Container();
        worldStage.sortableChildren = true;
        init();

        const subscriptions = [
            monsterRecord.subscribe((mr) => {
                updateEntities(mr, playerPosition, "monster");
            }),
            playerRecord.subscribe((pr) => {
                updateEntities(pr, playerPosition, "player");
            }),
            itemRecord.subscribe((ir) => {
                updateEntities(ir, playerPosition, "item");
            }),
            worldRecord.subscribe((wr) => {
                updateWorlds(wr, playerPosition);
            }),
            player.subscribe((p) => {
                updatePlayerPosition(p);
            }),
            target.subscribe((t) => {
                highlightTarget(t);
            }),
        ];

        return () => {
            for (const s of subscriptions) {
                s();
            }
        };
    });

    onDestroy(() => {
        if (app) {
            destroyShaders();
            clearInstancedShaderMeshes(worldStage!);
            app.stage.removeAllListeners();
            app = null;
        }
    });
</script>

{#if playerPosition}
    <div
        class={cn("w-full h-full p-0 m-0", $$restProps.class)}
        bind:this={container}
        bind:clientHeight
        bind:clientWidth
    ></div>
{/if}

import { getEntityId } from "$lib/crossover/utils";
import type { AssetMetadata } from "$lib/crossover/world/types";
import type {
    EntityType,
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import { gsap } from "gsap";
import { Container, type DestroyOptions } from "pixi.js";
import { IsoMesh } from "../../shaders";
import {
    CELL_WIDTH,
    loadAssetTexture,
    scaleToFitAndMaintainAspectRatio,
    swapMeshTexture,
    type Position,
} from "../utils";
import { ActionBubble } from "./ActionBubble";

export { SimpleEntityContainer };

class SimpleEntityContainer extends Container {
    public entityId: string;
    public entityType: EntityType;
    public entity: Player | Monster | Item;
    public mesh: IsoMesh | null = null;

    public zOffset: number = 0;
    public zScale: number = 0;
    public renderLayer: number = 0;

    public isoPosition: Position | null = null;

    public asset: AssetMetadata | null = null;
    public variant: string | null = null;

    public tween: gsap.core.Tween | null = null;
    public actionBubble: ActionBubble;

    constructor({
        entity,
        zOffset,
        zScale,
        renderLayer,
    }: {
        entity: Player | Monster | Item;
        zOffset?: number;
        zScale?: number;
        renderLayer?: number;
    }) {
        super();

        // Set properties
        const [entityId, entityType] = getEntityId(entity);
        this.entityId = entityId;
        this.entityType = entityType;
        this.entity = entity;
        this.zOffset = zOffset || 0;
        this.zScale = zScale || 0;
        this.renderLayer = renderLayer || 0;

        // Create action bubble
        this.actionBubble = new ActionBubble();
        this.addChild(this.actionBubble);
    }

    async loadAsset(
        asset: AssetMetadata,
        options?: { variant?: string; anchor?: { x: number; y: number } },
    ) {
        if (this.mesh == null) {
            this.asset = asset;
            this.variant = options?.variant ?? null;
            const texture = await loadAssetTexture(asset, {
                variant: options?.variant,
            });
            if (texture == null) {
                console.warn(`Missing texture for ${this.entityId}`);
                return;
            }

            console.log(asset.path, asset.height);
            this.mesh = new IsoMesh({
                shaderName: "entity",
                texture,
                zOffset: this.zOffset,
                zScale: this.zScale,
                renderLayer: this.renderLayer,
                cellHeight: asset.height,
            });
            this.mesh.eventMode = "none"; // Prevents inheritance of parent eventMode
            this.addChild(this.mesh);

            // Set size
            const [width, height] = scaleToFitAndMaintainAspectRatio(
                texture.width,
                texture.height,
                asset.width * CELL_WIDTH,
                texture.height,
            );
            // Note: Containers themselves don't have intrinsic dimensions - their size is determined by their content and their scale.
            this.mesh.width = width;
            this.mesh.height = height;

            // Set pivot/anchor
            const anchor = texture.defaultAnchor ??
                options?.anchor ?? { x: 0.5, y: 0.5 };
            this.pivot.set(anchor.x * width, anchor.y * height);
        }
    }

    async swapVariant(variant: string) {
        if (this.mesh == null || this.asset == null) {
            return;
        }

        const texture = await loadAssetTexture(this.asset, {
            variant,
        });
        if (!texture) {
            console.error(`Missing texture for ${this.entityId}:${variant}`);
            return;
        }

        this.variant = variant;
        swapMeshTexture(this.mesh, texture);
    }

    updateIsoPosition(isoPosition: Position, duration?: number) {
        // Skip is position is the same
        if (
            this.isoPosition != null &&
            this.isoPosition.isoX === isoPosition.isoX &&
            this.isoPosition.isoY === isoPosition.isoY &&
            this.isoPosition.elevation === isoPosition.elevation
        ) {
            return;
        }

        this.isoPosition = isoPosition;
        this.updateDepth(
            isoPosition.isoX,
            isoPosition.isoY,
            isoPosition.elevation,
        );
        if (duration != null) {
            this.tween = gsap.to(this, {
                x: isoPosition.isoX,
                y: isoPosition.isoY - isoPosition.elevation,
                duration,
                overwrite: true, // overwrite previous tweens
            });
            this.position.set(
                isoPosition.isoX,
                isoPosition.isoY - isoPosition.elevation,
            );
        } else {
            this.position.set(
                isoPosition.isoX,
                isoPosition.isoY - isoPosition.elevation,
            );
        }
    }

    updateDepth(
        isoX: number,
        isoY: number,
        elevation: number,
        z?: number,
    ): void {
        // Update zIndex
        this.zIndex = this.renderLayer * isoY + (z ?? 0);

        // Update mesh depth
        if (this.mesh) {
            this.mesh.updateDepth(isoX, isoY, elevation, z ?? 0);
        }
    }

    highlight(highlight: number) {
        if (
            this.mesh == null ||
            this.mesh.geometry.attributes == null ||
            this.mesh.geometry.attributes["aInstanceHighlight"] == null
        ) {
            return;
        }
        const ih = this.mesh.geometry.getBuffer("aInstanceHighlight");
        ih.data.fill(highlight);
        ih.update();
    }

    clearHighlight(highlight?: number) {
        if (
            this.mesh == null ||
            this.mesh.geometry.attributes == null ||
            this.mesh.geometry.attributes["aInstanceHighlight"] == null
        ) {
            return;
        }
        const ih = this.mesh.geometry.getBuffer("aInstanceHighlight");
        // Clear all highlights
        if (highlight == null) {
            ih.data.fill(0);
            ih.update();
        }
        // Clear specific highlight
        else {
            for (var i = 0; i < ih.data.length; i++) {
                if (ih.data[i] === highlight) {
                    ih.data[i] = 0;
                }
            }
            ih.update();
        }
    }

    destroy(options?: DestroyOptions): void {
        if (this.tween != null) {
            this.tween.kill();
        }
        super.destroy(options);
    }
}

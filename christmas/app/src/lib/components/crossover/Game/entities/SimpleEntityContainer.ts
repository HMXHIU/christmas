import type { AssetMetadata } from "$lib/crossover/world/types";
import { Container, Sprite } from "pixi.js";
import { swapMeshTexture } from "../../shaders";
import { IsoMesh } from "../../shaders/IsoMesh";
import { layers } from "../layers";
import { CELL_WIDTH } from "../settings";
import { loadAssetTexture, scaleToFitAndMaintainAspectRatio } from "../utils";
import { EntityContainer } from "./EntityContainer";
import { createProjectedShadow } from "./shadows";

export { SimpleEntityContainer };

class SimpleEntityContainer extends EntityContainer {
    public mesh: IsoMesh | null = null;
    public asset: AssetMetadata | null = null;
    public variant: string | null = null;

    async loadAsset(
        asset: AssetMetadata,
        options?: { variant?: string; anchor?: { x: number; y: number } },
    ) {
        if (this.mesh == null && !this.destroyed) {
            this.asset = asset;
            this.variant = options?.variant ?? null;

            const texture = await loadAssetTexture(asset, {
                variant: options?.variant,
            });
            if (texture == null) {
                console.warn(`Missing texture for ${this.entityId}`);
                return;
            }

            this.mesh = new IsoMesh({
                shaderName: "entity",
                texture,
                cellHeight: asset.height,
                geometryUid: this.entityId,
                ...layers.depthPartition("entity"),
            });
            this.mesh.eventMode = "none"; // Prevents inheritance of parent eventMode
            this.addChild(this.mesh);

            // Set size
            const { width, height } = scaleToFitAndMaintainAspectRatio(
                texture.width,
                texture.height,
                (asset.width || 1) * CELL_WIDTH,
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

    asSpriteContainer(): Container | null {
        if (this.mesh && this.mesh.texture) {
            const c = new Container();
            const s = new Sprite(this.mesh.texture);

            c.rotation = this.rotation;
            c.position.copyFrom(this.position);
            c.scale.copyFrom(this.scale);
            c.pivot.copyFrom(this.pivot);
            c.zIndex = this.zIndex;

            s.rotation = this.mesh.rotation;
            s.position.copyFrom(this.mesh.position);
            s.scale.copyFrom(this.mesh.scale);
            s.pivot.copyFrom(this.mesh.pivot);
            s.zIndex = this.mesh.zIndex;

            c.addChild(s);
            return c;
        }

        return null;
    }

    async getShadow(): Promise<IsoMesh | null> {
        if (this.mesh) {
            return await createProjectedShadow(this.mesh);
        }
        return null;
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

    updateDepth(depth: number): void {
        super.updateDepth(depth);

        // Update mesh depth
        if (this.mesh) {
            this.mesh.updateDepth(depth);
        }
    }

    highlight(highlight: number) {
        if (this.mesh?.geometry.attributes?.aInstanceHighlight == null) {
            return;
        }
        const ih = this.mesh.geometry.getBuffer("aInstanceHighlight");
        ih.data.fill(highlight);
        ih.update();
    }

    clearHighlight(highlight?: number) {
        if (this.mesh?.geometry.attributes?.aInstanceHighlight == null) {
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
}

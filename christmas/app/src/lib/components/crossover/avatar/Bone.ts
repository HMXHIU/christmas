// src/lib/Bone.ts
import { cloneDeep } from "lodash";
import { Assets, Container, Texture } from "pixi.js";
import { swapMeshTexture } from "../Game/utils";
import { IsoMesh } from "../shaders/IsoMesh";
import type { BoneMetadata, BoneTextureTransform } from "./types";

export class Bone extends Container {
    public name: string;
    public mesh: IsoMesh | null = null;
    public boneMetadata: BoneMetadata;
    public textures: Record<string, string>;
    public textureKey: string | null = null;
    public overlayTextureKey: string | null = null;

    public zOffset: number = 0;
    public zScale: number = 0;
    public renderLayer: number = 0;
    public boneRenderLayer: number = 0;

    constructor({
        name,
        boneMetadata,
        textureKey,
        textures,
        zOffset,
        zScale,
        renderLayer,
        boneRenderLayer,
    }: {
        name: string;
        boneMetadata: BoneMetadata;
        textures: Record<string, string>;
        textureKey?: string;
        zOffset?: number;
        zScale?: number;
        renderLayer?: number;
        boneRenderLayer?: number;
    }) {
        super();

        // Note: don't set textureKey here, only in setTexture
        this.name = name;
        this.boneMetadata = cloneDeep(boneMetadata);
        this.textures = textures;
        this.zOffset = zOffset || 0;
        this.zScale = zScale || 0;
        this.renderLayer = renderLayer ?? 0;
        this.boneRenderLayer = boneRenderLayer ?? 0;

        // Get texture
        if (textureKey != null) {
            this.setTexture(textureKey);
        }
    }

    getTextureTransform(): BoneTextureTransform | null {
        return this.textureKey
            ? this.boneMetadata.textures[this.textureKey]
            : null;
    }

    setTextureTransform(transform: BoneTextureTransform): void {
        if (this.mesh == null || this.textureKey == null) {
            return;
        }

        // Update the mesh pivot based on the new anchor and texture dimensions
        this.mesh.pivot.set(
            this.mesh.texture.width * transform.anchor.x,
            this.mesh.texture.height * transform.anchor.y,
        );

        // Update the mesh rotation (rotate the mesh to 0 by)
        this.mesh.rotation = -transform.rotation;

        // Update the texture transform
        this.boneMetadata.textures[this.textureKey] = transform;
    }

    async addTexture(textureKey: string, path: string): Promise<Texture> {
        // Skip if already added
        if (this.textures[textureKey] != null) {
            return await Assets.load(this.textures[textureKey]);
        }

        // Use current transform as the new texture transform
        const transform = this.getTextureTransform();
        if (transform == null) {
            throw new Error(`Texture transform not found for ${textureKey}`);
        }
        // Save to textures and metadata
        this.textures[textureKey] = path;
        this.boneMetadata.textures[textureKey] = transform;

        return await Assets.load(this.textures[textureKey]);
    }

    async setOverlayTexture(
        textureKey: string,
        options?: {
            path?: string;
        },
    ): Promise<void> {
        // Skip if no mesh or shader
        if (this.mesh == null || this.mesh.shader == null) {
            return;
        }
        // Skip if already loaded
        if (
            this.overlayTextureKey === textureKey &&
            this.mesh.shader.resources.uniforms.uOverlayTextureEnabled > 0
        ) {
            return;
        }

        // Add new textureKey to textures and metadata if necessary
        if (options?.path != null) {
            await this.addTexture(textureKey, options.path);
        }
        const texture = await Assets.load(this.textures[textureKey]);

        // Set and enable overlay texture
        this.mesh.shader.resources.uOverlayTexture = texture.source;
        this.mesh.shader.resources.uniforms.uniforms.uOverlayTextureEnabled = 1;

        // Update texture key (Do this last)
        this.overlayTextureKey = textureKey;
    }

    async clearOverlayTexture() {
        if (this.mesh == null || this.mesh.shader == null) {
            return;
        }
        this.mesh.shader.resources.uniforms.uniforms.uOverlayTextureEnabled = 0;
    }

    async setTexture(
        textureKey: string,
        options?: {
            uid?: string;
            path?: string;
        },
    ) {
        // Skip if already loaded
        if (this.textureKey === textureKey) {
            return;
        }

        // Add new textureKey to textures and metadata if necessary
        if (options?.path != null) {
            await this.addTexture(textureKey, options.path);
        }
        const texture = await Assets.load(this.textures[textureKey]);

        // Create mesh if it doesn't exist
        if (!this.mesh) {
            this.mesh = new IsoMesh({
                shaderName: "entity",
                texture,
                zOffset: this.zOffset,
                zScale: this.zScale,
                renderLayer: this.renderLayer,
                uid: options?.uid,
                textures: {
                    uOverlayTexture: { texture, enabled: 0 },
                },
            });
            this.addChild(this.mesh);
        }

        // Swap texture of existing mesh if needed
        if (this.textureKey !== textureKey) {
            swapMeshTexture(this.mesh, texture);
        }

        this.setTextureTransform(this.boneMetadata.textures[textureKey]);

        // Update texture key (Do this last)
        this.textureKey = textureKey;
    }

    tintTexture(tint: Float32Array) {
        // Skip if no mesh or shader
        if (this.mesh == null || this.mesh.shader == null) {
            return;
        }
        this.mesh.shader.resources.uniforms.uniforms.uTint = tint;
    }

    updateDepth(
        isoX: number,
        isoY: number,
        elevation: number,
        z?: number,
    ): void {
        // Update zIndex
        this.zIndex = this.renderLayer * isoY + this.boneRenderLayer + (z ?? 0);

        // Update mesh depth
        if (this.mesh) {
            this.mesh.updateDepth(
                isoX,
                isoY,
                elevation,
                this.boneRenderLayer + (z ?? 0),
            );
        }
    }
}

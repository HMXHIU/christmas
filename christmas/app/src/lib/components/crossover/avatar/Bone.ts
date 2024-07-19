// src/lib/Bone.ts
import { cloneDeep } from "lodash";
import { Assets, Container } from "pixi.js";
import { IsoMesh } from "../shaders";
import type { BoneMetadata, BoneTextureTransform } from "./types";

export class Bone extends Container {
    public name: string;
    public mesh: IsoMesh | null = null;
    public boneMetadata: BoneMetadata;
    public textures: Record<string, string>;
    public textureKey: string;

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
        textureKey: string;
        textures: Record<string, string>;
        zOffset?: number;
        zScale?: number;
        renderLayer?: number;
        boneRenderLayer?: number;
    }) {
        super();
        this.name = name;
        this.boneMetadata = cloneDeep(boneMetadata);
        this.textureKey = textureKey;
        this.textures = textures;

        this.zOffset = zOffset || 0;
        this.zScale = zScale || 0;
        this.renderLayer = renderLayer ?? 0;
        this.boneRenderLayer = boneRenderLayer ?? 0;

        // Get texture
        this.setTexture(textureKey);
    }

    getBoneTextureTransform(): BoneTextureTransform {
        return this.boneMetadata.textures[this.textureKey];
    }

    setTextureTransform(transform: BoneTextureTransform): void {
        if (this.mesh == null) {
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

    async setTexture(textureKey: string) {
        // Create mesh if it doesn't exist
        if (!this.mesh) {
            const texture = await Assets.load(this.textures[textureKey]);
            this.mesh = new IsoMesh({
                shaderName: "entity",
                texture,
                zOffset: this.zOffset,
                zScale: this.zScale,
                renderLayer: this.renderLayer,
            });
            this.addChild(this.mesh);
        }

        // Set texture transform
        this.setTextureTransform(this.boneMetadata.textures[textureKey]);

        // Update texture key
        this.textureKey = textureKey;
    }

    clearTexture(): void {
        if (this.mesh) {
            this.removeChild(this.mesh);
            this.mesh.destroy();
            this.mesh = null;
        }
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

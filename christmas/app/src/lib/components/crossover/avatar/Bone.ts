// src/lib/Bone.ts
import { cloneDeep } from "lodash";
import { Assets, Container, Geometry, Mesh, Shader } from "pixi.js";
import { loadShaderGeometry } from "../shaders";
import type { BoneMetadata, BoneTextureTransform } from "./types";

export class Bone extends Container {
    public name: string;
    public mesh: Mesh<Geometry, Shader> | null = null;
    public boneMetadata: BoneMetadata;
    public textures: Record<string, string>;
    public textureKey: string;
    public zOffset: number = 0;
    public zScale: number = 0;

    constructor({
        name,
        boneMetadata,
        textureKey,
        textures,
        zOffset,
        zScale,
    }: {
        name: string;
        boneMetadata: BoneMetadata;
        textureKey: string;
        textures: Record<string, string>;
        zOffset?: number;
        zScale?: number;
    }) {
        super();
        this.name = name;
        this.boneMetadata = cloneDeep(boneMetadata);
        this.textureKey = textureKey;
        this.textures = textures;
        this.zOffset = zOffset || 0;
        this.zScale = zScale || 0;

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
        const texture = await Assets.load(this.textures[textureKey]);

        // Create mesh if it doesn't exist
        if (!this.mesh) {
            const shaderGeometry = loadShaderGeometry(
                "entity",
                texture,
                texture.width,
                texture.height,
                { zOffset: this.zOffset, zScale: this.zScale },
            );

            this.mesh = new Mesh<Geometry, Shader>({
                shader: shaderGeometry.shader,
                geometry: shaderGeometry.geometry,
                texture: texture, // need to set the texture here as it is used in `setTextureTransform`
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
}

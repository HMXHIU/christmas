// src/lib/Bone.ts
import { cloneDeep } from "lodash";
import { Assets, Container } from "pixi.js";
import { CustomMesh } from "./CustomMesh";
import type { BoneMetadata, BoneTextureTransform } from "./types";

export class Bone extends Container {
  public name: string;
  public mesh: CustomMesh | null = null;
  public boneMetadata: BoneMetadata;
  public textures: Record<string, string>;
  public textureKey: string;

  constructor({
    name,
    boneMetadata,
    textureKey,
    textures,
  }: {
    name: string;
    boneMetadata: BoneMetadata;
    textureKey: string;
    textures: Record<string, string>;
  }) {
    super();
    this.name = name;
    this.boneMetadata = cloneDeep(boneMetadata);
    this.textureKey = textureKey;
    this.textures = textures;

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
      this.mesh.texture.height * transform.anchor.y
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
      this.mesh = new CustomMesh(texture, texture.width, texture.height);
      this.addChild(this.mesh);
    }

    // Set texture and geometry
    this.mesh.texture = texture;
    this.mesh.geometry = CustomMesh.createQuadGeometry(
      texture.width,
      texture.height
    );

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

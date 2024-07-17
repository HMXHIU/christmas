// src/lib/Avatar.ts
import { cloneDeep } from "lodash";
import { Assets, Container } from "pixi.js";
import { AnimationManager } from "./AnimationManager";
import { Bone } from "./Bone";
import type { AvatarMetadata, BoneMetadata, Pose } from "./types";

export class Avatar extends Container {
  public bones: Record<string, Bone> = {};
  public rootBone: Bone | null = null;
  public animationManager: AnimationManager;
  public metadata: AvatarMetadata | null = null;

  constructor() {
    super();
    this.animationManager = new AnimationManager();
    this.sortableChildren = true;
  }

  async preloadTextures(): Promise<void> {
    if (!this.metadata) return;
    const texturePromises = Object.values(this.metadata.textures).map((url) =>
      Assets.load(url)
    );
    await Promise.all(texturePromises);
  }

  async loadFromMetadata(metadata: AvatarMetadata): Promise<void> {
    this.metadata = cloneDeep(metadata);

    // Clear existing bones
    this.bones = {};
    this.rootBone = null;
    this.removeChildren();

    // Preload all textures
    await this.preloadTextures();

    // Create bones
    for (const [boneName, boneMetadata] of Object.entries(metadata.bones)) {
      // Use the first texture key as default
      const textureKey = Object.keys(boneMetadata.textures)[0];
      const bone = new Bone({
        name: boneName,
        boneMetadata: boneMetadata,
        textures: metadata.textures,
        textureKey,
      });
      this.bones[boneName] = bone;

      // Auto-rig the texture (use the first texture as default)
      const boneTextureTransform = boneMetadata.textures[textureKey];
      if (textureKey && boneTextureTransform) {
        await bone.setTexture(textureKey);
      }
    }

    // Set up parent-child relationships
    this.setupBoneHierarchy(metadata.bones);
  }

  private setupBoneHierarchy(bonesRecord: Record<string, BoneMetadata>): void {
    // Need to start with the root bone first because we can only resize the bone after adding it to the parent
    const rootBoneName = Object.keys(bonesRecord).find(
      (boneName) => bonesRecord[boneName].parent == null
    );
    if (!rootBoneName) {
      console.error("Root bone not found in metadata");
      return;
    }
    this.rootBone = this.bones[rootBoneName];
    if (!this.rootBone) {
      console.error("Root bone not found");
      return;
    }

    // Add root bone to avatar
    this.addChild(this.rootBone);

    const rigBones = (parentBoneName: string) => {
      const parentBone = this.getBone(parentBoneName);
      if (!parentBone) {
        console.warn("Parent bone not found:", parentBoneName);
        return;
      }

      // Get this bone's children
      const children = Object.entries(bonesRecord).filter(
        ([boneName, boneData]) => {
          return boneData.parent === parentBoneName;
        }
      );

      // Add children to parent bone
      for (const [boneName, boneData] of children) {
        const childBone = this.getBone(boneName);
        if (!childBone) {
          console.warn("Bone not found:", boneName);
          continue;
        }
        // Set bone size after adding to parent
        parentBone.addChild(childBone);
        // Recursively rig children
        rigBones(boneName);
      }
    };

    rigBones(rootBoneName);
  }

  getBone(name: string): Bone | undefined {
    return this.bones[name];
  }

  getAllBones(): Bone[] {
    return Object.values(this.bones);
  }

  clearBoneTexture(boneName: string): void {
    const bone = this.bones[boneName];
    if (bone && bone.mesh) {
      this.removeChild(bone.mesh);
      bone.clearTexture();
    }
  }

  async pose(pose: Pose) {
    await this.animationManager.pose(pose, this.bones);
  }

  playAnimation(
    animationName: string,
    loop: boolean = false,
    onComplete?: () => void
  ): void {
    this.animationManager.playAnimation(animationName, this.bones, loop, () => {
      if (onComplete) onComplete();
    });
  }

  stopAnimation(): void {
    this.animationManager.stopAnimation();
  }

  deserialize(): AvatarMetadata {
    if (this.metadata == null) {
      throw new Error("Avatar metadata not loaded");
    }
    return {
      bones: Object.fromEntries(
        this.getAllBones().map((bone) => {
          return [bone.name, bone.boneMetadata];
        })
      ),
      textures: this.metadata.textures,
    };
  }
}

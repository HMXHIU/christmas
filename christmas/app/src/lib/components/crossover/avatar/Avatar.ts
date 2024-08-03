// src/lib/Avatar.ts
import { cloneDeep } from "lodash";
import { Assets, Container, type DestroyOptions } from "pixi.js";
import { AnimationManager } from "./AnimationManager";
import { Bone } from "./Bone";
import type { AvatarMetadata, BoneMetadata, Pose } from "./types";

export class Avatar extends Container {
    public bones: Record<string, Bone> = {};
    public rootBone: Bone | null = null;
    public animationManager: AnimationManager;
    public metadata: AvatarMetadata | null = null;

    public zOffset: number = 0;
    public zScale: number = 0;
    public renderLayer: number = 0;

    constructor(options?: {
        zOffset?: number;
        zScale?: number;
        renderLayer?: number;
    }) {
        super();
        this.animationManager = new AnimationManager();
        this.sortableChildren = true;
        this.zOffset = options?.zOffset || 0;
        this.zScale = options?.zScale || 0;
        this.renderLayer = options?.renderLayer || 0;
        this.cullable = true;
    }

    async preloadTextures(): Promise<void> {
        if (!this.metadata) return;
        const texturePromises = Object.values(this.metadata.textures).map(
            (url) => Assets.load(url),
        );
        await Promise.all(texturePromises);
    }

    async loadFromMetadata(
        metadata: AvatarMetadata,
        uid?: string,
    ): Promise<void> {
        this.metadata = cloneDeep(metadata);

        // Clear existing bones
        for (const bone of Object.values(this.bones)) {
            this.removeChild(bone);
        }
        this.bones = {};
        this.rootBone = null;

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
                zOffset: this.zOffset,
                zScale: this.zScale,
            });
            bone.eventMode = "none"; // Prevents inheritance of parent eventMode
            this.bones[boneName] = bone;

            // Auto-rig the texture (use the first texture as default)
            const boneTextureTransform = boneMetadata.textures[textureKey];
            if (textureKey && boneTextureTransform) {
                const shaderUid =
                    uid != null ? `${uid}_${boneName}` : undefined;
                await bone.setTexture(textureKey, { uid: shaderUid });
            }
        }

        // Set up parent-child relationships
        this.setupBoneHierarchy(metadata.bones);
    }

    private setupBoneHierarchy(
        bonesRecord: Record<string, BoneMetadata>,
    ): void {
        // Need to start with the root bone first because we can only resize the bone after adding it to the parent
        const rootBoneName = Object.keys(bonesRecord).find(
            (boneName) => bonesRecord[boneName].parent == null,
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
                },
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

        // Set the pivot at the rootBone (usually the pivotBone)
        if (this.rootBone != null) {
            this.pivot.x = this.rootBone.x;
            this.pivot.y = this.rootBone.y;
        }
    }

    getBone(name: string): Bone | undefined {
        return this.bones[name];
    }

    getAllBones(): Bone[] {
        return Object.values(this.bones);
    }

    async pose(pose: Pose) {
        await this.animationManager.pose(pose, this.bones);
    }

    playAnimation(
        animationName: string,
        loop: boolean = false,
        onComplete?: () => void,
    ): void {
        this.animationManager.playAnimation(
            animationName,
            this.bones,
            loop,
            () => {
                if (onComplete) onComplete();
            },
        );
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
                }),
            ),
            textures: this.metadata.textures,
        };
    }

    updateDepth(
        isoX: number,
        isoY: number,
        elevation: number,
        z?: number,
    ): void {
        // Update zIndex
        this.zIndex = this.renderLayer * isoY + (z ?? 0);

        // Update bone depth
        for (const bone of this.getAllBones()) {
            bone.updateDepth(isoX, isoY, elevation, z);
        }
    }

    destroy(options?: DestroyOptions): void {
        this.animationManager.stopAnimation();
        super.destroy(options);
    }
}

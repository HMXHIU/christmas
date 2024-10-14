// src/lib/Avatar.ts
import { GAME_MORPHOLOGY } from "$lib/crossover/defs";
import { cloneDeep } from "lodash";
import { Assets, Container, Sprite, type DestroyOptions } from "pixi.js";
import { AnimationManager } from "./AnimationManager";
import { Bone } from "./Bone";
import type { AvatarMetadata, BoneMetadata, Pose } from "./types";

export class Avatar extends Container {
    public bones: Record<string, Bone> = {};
    public rootBone: Bone | null = null;
    public animationManager: AnimationManager;
    public metadata: AvatarMetadata | null = null;

    public depthStart: number = 0;
    public depthScale: number = 0;
    public depthLayer: number = 0;

    constructor({
        depthStart,
        depthLayer,
        depthScale,
    }: {
        depthStart: number;
        depthScale: number;
        depthLayer: number;
    }) {
        super({});
        this.animationManager = new AnimationManager();
        this.sortableChildren = true;
        this.depthStart = depthStart;
        this.depthScale = depthScale;
        this.depthLayer = depthLayer;
        this.cullable = true;
    }

    async preloadTextures(): Promise<void> {
        if (!this.metadata) return;
        const texturePromises = Object.values(this.metadata.textures).map((t) =>
            Assets.load(t),
        );
        await Promise.all(texturePromises);
    }

    asSpriteContainer(): Container | null {
        if (this.rootBone) {
            function makeSprite(root: Bone) {
                const boneTransform = root.getTextureTransform();
                const container = new Container();
                container.rotation = root.rotation;
                container.position.copyFrom(root.position);
                container.scale.copyFrom(root.scale);
                container.pivot.copyFrom(root.pivot);
                container.zIndex = root.zIndex;
                if (root.mesh && boneTransform) {
                    const sprite = new Sprite(root.mesh.texture);
                    container.addChild(sprite);
                    sprite.rotation = root.mesh.rotation;
                    sprite.scale.copyFrom(root.mesh.scale);
                    sprite.position.copyFrom(root.mesh.position);
                    sprite.pivot.copyFrom(root.mesh.pivot);
                    sprite.zIndex = root.mesh.zIndex;
                }
                for (const bone of root.children) {
                    if (bone instanceof Bone) {
                        container.addChild(makeSprite(bone));
                    }
                }
                return container;
            }
            return makeSprite(this.rootBone);
        }
        return null;
    }

    async loadFromMetadata(
        metadata: AvatarMetadata,
        entityId: string,
    ): Promise<void> {
        // Patch textures with actual url
        for (const k of Object.keys(metadata.textures)) {
            metadata.textures[k] = `${GAME_MORPHOLOGY}${metadata.textures[k]}`;
        }

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
                depthLayer: this.depthLayer,
                depthScale: this.depthScale,
                depthStart: this.depthStart,
                entityId,
            });
            bone.eventMode = "none"; // Prevents inheritance of parent eventMode
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

    updateDepth(depth: number): void {
        // Update zIndex
        this.zIndex = this.depthLayer + this.depthScale * depth;

        // Update bones depth
        for (const bone of this.getAllBones()) {
            bone.updateDepth(depth);
        }
    }

    destroy(options?: DestroyOptions): void {
        this.animationManager.stopAnimation();
        super.destroy(options);
    }
}

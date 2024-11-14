import { tints } from "$lib/components/crossover/shaders/materials";
import type { Item } from "$lib/crossover/types";
import { isItemEquipped } from "$lib/crossover/world/compendium";
import { compendium } from "$lib/crossover/world/settings/compendium";
import type { AssetMetadata } from "$lib/crossover/world/types";
import type { Container, DestroyOptions } from "pixi.js";
import { Avatar } from "../../avatar/Avatar";
import type { Bone } from "../../avatar/Bone";
import type { Light } from "../../shaders/ambient";
import type { IsoMesh } from "../../shaders/IsoMesh";
import { layers } from "../layers";
import { EntityContainer } from "./EntityContainer";
import { createBlobShadow } from "./shadows";

export { AvatarEntityContainer };

const actionToAnimation: Record<string, string> = {
    move: "walk",
};

function equippedTextureKey(boneName: string): string {
    return `eq_${boneName}`;
}

class AvatarEntityContainer extends EntityContainer {
    public avatar: Avatar;

    constructor(props: ConstructorParameters<typeof EntityContainer>[0]) {
        super(props);
        this.avatar = new Avatar(layers.depthPartition("entity"));
        this.addChild(this.avatar);
    }

    triggerAnimation(action: string) {
        super.triggerAnimation(action);

        // Animate avatar
        const animation = actionToAnimation[action] || action;
        if (animation in this.avatar.animationManager.animations) {
            this.avatar.playAnimation(animation);
        }
    }

    async setBoneEquipmentTexture(
        bone: Bone,
        asset: AssetMetadata,
        replace: boolean = false,
    ): Promise<string | null> {
        const textureKey = equippedTextureKey(bone.name);
        if (replace) {
            await bone.setTexture(textureKey, {
                path: asset.path,
            });
        } else {
            await bone.setOverlayTexture(textureKey, {
                path: asset.path,
            });
        }
        return textureKey;
    }

    /**
     * TODO: load from NFT + compendium
     *
     * @param items - Player equipped items
     */
    async loadInventory(items: Item[]) {
        const equippedTextureKeys = new Set();
        const equippedTints = new Set();
        const bonesToTint: [Bone, Float32Array][] = [];

        // Load equipped item textures
        for (const item of items) {
            if (isItemEquipped(item, this.entity)) {
                // Get all bone assets from equipmentAssets
                const prop = compendium[item.prop];
                if (prop.equipment?.assets) {
                    for (const [
                        boneName,
                        { asset, tint, replace },
                    ] of Object.entries(prop.equipment.assets)) {
                        const bone = this.avatar.getBone(boneName);
                        if (bone == null) continue;
                        // Set bone texture
                        if (asset != null) {
                            equippedTextureKeys.add(
                                await this.setBoneEquipmentTexture(
                                    bone,
                                    asset,
                                    replace,
                                ),
                            );
                        }
                        // Add bonesToTint
                        if (tint != null) {
                            bonesToTint.push([bone, tint]);
                        }
                    }
                }
            }
        }

        for (const bone of this.avatar.getAllBones()) {
            // Remove textures (use default)
            if (!equippedTextureKeys.has(equippedTextureKey(bone.name))) {
                // Clear overlay texture
                await bone.clearOverlayTexture();
                // Set to default texture
                await bone.setDefaultTexture();
            }

            // Remove tints
            if (!equippedTints.has(bone.name)) {
                bone.tintTexture(tints.none);
            }
        }

        // Tint default textures (have to do after all textures have been set or replaced)
        for (const [bone, tint] of bonesToTint) {
            if (
                // tint if bone texture is default (might be replaced)
                bone.getDefaultTextureKey() === bone.textureKey
            ) {
                bone.tintTexture(tint);
                equippedTints.add(bone.name);
            }
        }

        // Update the depth for new meshes
        if (this.isoPosition != null) {
            this.updateDepth(this.isoPosition.isoY);
        }
    }

    asSpriteContainer(): Container | null {
        return this.avatar.asSpriteContainer();
    }

    async getShadow(): Promise<IsoMesh> {
        return createBlobShadow();
    }

    public updateLight(light: Light) {
        for (const bone of this.avatar.getAllBones()) {
            if (bone.mesh) {
                bone.mesh.updateLight(light);
            }
        }
    }

    updateDepth(depth: number): void {
        super.updateDepth(depth);

        // Update mesh depth
        if (this.avatar) {
            this.avatar.updateDepth(depth);
        }
    }

    public destroy(options?: DestroyOptions): void {
        this.avatar.destroy();
        super.destroy(options);
    }
}

import {
    compendium,
    isItemEquipped,
    itemAttibutes,
    tints,
} from "$lib/crossover/world/compendium";
import type { Item } from "$lib/server/crossover/redis/entities";
import { Avatar } from "../../avatar/Avatar";
import { EntityContainer } from "./EntityContainer";

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
        this.avatar = new Avatar({
            zOffset: this.zOffset,
            zScale: this.zScale,
            renderLayer: this.renderLayer,
        });
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

    async setEquipmentTexture(
        path: string,
        boneName: string,
        tint?: Float32Array,
    ): Promise<string | null> {
        if (boneName != null) {
            const bone = this.avatar.getBone(boneName);
            if (bone != null) {
                // Set overlay texture
                const textureKey = equippedTextureKey(boneName);
                await bone.setOverlayTexture(textureKey, {
                    path,
                });
                // Tint texture
                if (tint != null) {
                    bone.tintTexture(tint);
                }
                return textureKey;
            }
        }
        return null;
    }

    /**
     * TODO: load from NFT + compendium
     *
     * @param items - Player equipped items
     */
    async loadInventory(items: Item[]) {
        const equipped = new Set();

        // Load equipped item textures
        for (const item of items) {
            if (isItemEquipped(item, this.entity)) {
                const prop = compendium[item.prop];

                // Get item tint
                const { tint } = itemAttibutes(item);

                // Get all bone assets from equipmentAssets
                if (prop.equipmentAssets != null) {
                    for (const [boneName, asset] of Object.entries(
                        prop.equipmentAssets,
                    )) {
                        const textureKey = await this.setEquipmentTexture(
                            asset.path,
                            boneName,
                            tint,
                        );
                        equipped.add(textureKey);
                    }
                }
            }
        }

        // Use default texture for un-equipped items (needed when user unequips an item)
        for (const bone of this.avatar.getAllBones()) {
            if (!equipped.has(equippedTextureKey(bone.name))) {
                // Clear overlay texture
                bone.clearOverlayTexture();
                // Reset tint
                bone.tintTexture(tints.none);
            }
        }

        // Update the depth for new meshes
        if (this.isoPosition != null) {
            this.updateDepth(
                this.isoPosition.isoX,
                this.isoPosition.isoY,
                this.isoPosition.elevation,
            );
        }
    }

    updateDepth(
        isoX: number,
        isoY: number,
        elevation: number,
        z?: number,
    ): void {
        super.updateDepth(isoX, isoY, elevation, z);

        // Update mesh depth
        if (this.avatar) {
            this.avatar.updateDepth(isoX, isoY, elevation, z ?? 0);
        }
    }
}

import {
    compendium,
    isItemEquipped,
    type EquipmentSlot,
} from "$lib/crossover/world/compendium";
import type { Item } from "$lib/server/crossover/redis/entities";
import { Avatar } from "../../avatar/Avatar";
import { EntityContainer } from "./EntityContainer";

export { AvatarEntityContainer };

const actionToAnimation: Record<string, string> = {
    move: "walk",
};

const equipmentSlotToBone: Record<EquipmentSlot, string | null> = {
    ch: "torsoBone",
    rh: null,
    lh: null,
    ft: null,
    hd: "headBone",
    nk: null,
    lg: null,
    r1: null,
    r2: null,
};

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
        slot: EquipmentSlot,
    ): Promise<string | null> {
        const boneName = equipmentSlotToBone[slot];
        if (boneName != null) {
            const bone = this.avatar.getBone(boneName);
            if (bone != null) {
                await bone.setTexture(slot, {
                    uid: this.entityId,
                    path,
                });
                return boneName;
            }
        }
        return null;
    }

    async loadInventory(items: Item[]) {
        const equipped = new Set();

        // Load equipped item textures
        for (const item of items) {
            if (isItemEquipped(item, this.entity)) {
                const prop = compendium[item.prop]; // TODO: load from NFT
                const boneName = await this.setEquipmentTexture(
                    prop.asset.path,
                    item.locT as EquipmentSlot,
                );
                equipped.add(boneName);
            }
        }

        // Use default texture for un-equipped items (needed when user unequips an item)
        for (const bone of this.avatar.getAllBones()) {
            if (!equipped.has(bone.name)) {
                const defaultTextureKey = Object.keys(
                    bone.boneMetadata.textures,
                )[0];
                if (defaultTextureKey != null) {
                    await bone.setTexture(defaultTextureKey);
                }
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

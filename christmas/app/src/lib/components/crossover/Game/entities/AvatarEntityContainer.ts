import { Avatar } from "../../avatar/Avatar";
import { EntityContainer } from "./EntityContainer";

export { AvatarEntityContainer };

const animationTranslate: Record<string, string> = {
    move: "walk",
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
        const animation = animationTranslate[action] || action;
        if (animation in this.avatar.animationManager.animations) {
            this.avatar.playAnimation(animation);
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

import { actions, type Actions } from "$lib/crossover/world/actions";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import { gsap } from "gsap";
import {
    Assets,
    Graphics,
    Sprite,
    Texture,
    type DestroyOptions,
} from "pixi.js";
import { RENDER_ORDER } from "../utils";

export { ActionBubble };

class ActionBubble extends Sprite {
    public alphaTween: gsap.core.Tween | null = null;
    public scaleTween: gsap.core.Tween | null = null;

    constructor(width: number = 60, height: number = 60) {
        super({
            texture: Texture.EMPTY,
            visible: false,
            alpha: 0,
            height,
            width,
            anchor: { x: 0.5, y: 0.5 },
        });

        // Create a bubble mask
        const mask = new Graphics();
        mask.circle(0, 0, Math.max(width, height) / 2);
        mask.fill({ color: 0xffffff });
        mask.position = { x: width / 2, y: height / 2 };
        mask.pivot = { x: width / 2, y: height / 2 };

        // Apply mask
        this.mask = mask;
        this.addChild(mask);
    }

    async setAction(action: Actions) {
        const { ticks, icon } = actions[action];

        // Get icon texture
        const [bundleName, alias] = icon.path.split("/").slice(-2);
        const bundle = await Assets.loadBundle(bundleName);
        const texture: Texture = bundle[alias].textures[icon.icon];

        // Set position above parent container
        this.x = -this.parent.pivot.x + this.parent.width / 2 + this.width / 2;
        this.y = -this.parent.pivot.y - this.height;

        // Set texture & make visible
        this.texture = texture;
        this.visible = true;
        this.alpha = 1;
        this.scale.x = this.scale.y = 1;

        // Tween alpha & scale
        const duration = Math.max((ticks * MS_PER_TICK) / 1000, 1) * 2;
        this.alphaTween = gsap.to(this, {
            duration,
            alpha: 0,
            ease: "power2.in",
            overwrite: true,
            onComplete: () => {
                if (this != null) {
                    this.visible = false;
                }
            },
        });
        this.scaleTween = gsap.to(this.scale, {
            duration,
            x: this.scale.x * 1.7,
            y: this.scale.y * 1.7,
            overwrite: true,
            ease: "power2.out",
            onComplete: () => {
                if (this != null) {
                    this.scale.x = this.scale.y = 1;
                }
            },
        });
    }

    updateDepth(isoY: number) {
        this.zIndex = RENDER_ORDER.icon * isoY;
    }

    destroy(options?: DestroyOptions): void {
        if (this.alphaTween != null) {
            this.alphaTween.kill();
        }
        if (this.scaleTween != null) {
            this.scaleTween.kill();
        }
        super.destroy(options);
    }
}

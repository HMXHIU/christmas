import { actions, type Actions } from "$lib/crossover/world/actions";
import { MS_PER_TICK } from "$lib/crossover/world/settings";
import { gsap } from "gsap";
import { Assets, Container, Texture, type DestroyOptions } from "pixi.js";
import { swapMeshTexture } from "../../shaders";
import { IsoMesh } from "../../shaders/IsoMesh";
import { RENDER_ORDER, Z_OFF, Z_SCALE } from "../utils";

export { ActionBubble };

const ROT_45 = Math.PI / 4;

class ActionBubble extends Container {
    public isoMesh: IsoMesh | null = null;
    public tween: gsap.core.Tween | null = null;

    async setAction(action: Actions) {
        const { ticks, icon } = actions[action];

        // Get icon texture
        const [bundleName, alias] = icon.path.split("/").slice(-2);
        const bundle = await Assets.loadBundle(bundleName);
        const texture: Texture = bundle[alias].textures[icon.icon];
        const anchor = texture.defaultAnchor || { x: 0.5, y: 0.5 };

        // Create isoMesh
        if (!this.isoMesh) {
            // Create the IsoMesh
            this.isoMesh = new IsoMesh({
                shaderName: "entity",
                texture,
                zOffset: Z_OFF.entity,
                zScale: Z_SCALE,
                renderLayer: RENDER_ORDER.icon,
            });
            this.isoMesh.visible = false;
            this.addChild(this.isoMesh);

            // Make isometric
            this.pivot = {
                x: anchor.x * texture.width,
                y: anchor.y * texture.height,
            };
            this.rotation = ROT_45;
        } else {
            swapMeshTexture(this.isoMesh, texture);
        }

        // Set texture & make visible
        this.isoMesh.visible = true;
        this.scale.set(0);

        // Tween
        const duration = Math.max((ticks * MS_PER_TICK) / 1000, 1);
        this.tween = gsap.fromTo(
            this,
            { pixi: { scaleX: 0, scaleY: 0 } },
            {
                duration,
                yoyo: true,
                repeat: 1,
                overwrite: true,
                ease: "elastic.out",
                pixi: {
                    scaleX: 3,
                    scaleY: 3,
                },
                onComplete: () => {
                    if (this.isoMesh) {
                        this.isoMesh.visible = false;
                    }
                },
            },
        );
    }

    updateDepth(isoY: number) {
        this.zIndex = RENDER_ORDER.icon * isoY;
        if (this.isoMesh) {
            this.isoMesh.updateDepth(isoY);
        }
    }

    destroy(options?: DestroyOptions): void {
        if (this.tween != null) {
            this.tween.kill();
        }
        super.destroy(options);
    }
}

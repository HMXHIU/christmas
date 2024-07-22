import { getEntityId } from "$lib/crossover/utils";
import { actions, type Actions } from "$lib/crossover/world/actions";
import type {
    EntityType,
    Item,
    Monster,
    Player,
} from "$lib/server/crossover/redis/entities";
import { gsap } from "gsap";
import { type DestroyOptions } from "pixi.js";
import { Avatar } from "../../avatar/Avatar";
import { type Position } from "../utils";
import { ActionBubble } from "./ActionBubble";

export { AvatarEntityContainer };

const animationTranslate: Record<string, string> = {
    move: "walk",
};

class AvatarEntityContainer extends Avatar {
    public entityId: string;
    public entityType: EntityType;
    public entity: Player | Monster | Item;

    public zOffset: number = 0;
    public zScale: number = 0;
    public renderLayer: number = 0;

    public isoPosition: Position | null = null;

    public tween: gsap.core.Tween | null = null;
    public actionBubble: ActionBubble;

    constructor({
        entity,
        zOffset,
        zScale,
        renderLayer,
    }: {
        entity: Player | Monster | Item;
        zOffset?: number;
        zScale?: number;
        renderLayer?: number;
    }) {
        super({ zOffset, zScale, renderLayer });

        // Set properties
        const [entityId, entityType] = getEntityId(entity);
        this.entityId = entityId;
        this.entityType = entityType;
        this.entity = entity;
        this.zOffset = zOffset || 0;
        this.zScale = zScale || 0;
        this.renderLayer = renderLayer || 0;

        // Create action bubble
        this.actionBubble = new ActionBubble();
        this.addChild(this.actionBubble);

        this.cullable = true;
    }

    triggerAnimation(action: string) {
        // Animation action bubble
        if (this.actionBubble != null && action in actions) {
            this.actionBubble.setAction(action as Actions);
        }

        // Animate avatar
        const animation = animationTranslate[action] || action;
        if (animation in this.animationManager.animations) {
            this.playAnimation(animation);
        }
    }

    updateIsoPosition(isoPosition: Position, duration?: number) {
        // Skip is position is the same
        if (
            this.isoPosition != null &&
            this.isoPosition.isoX === isoPosition.isoX &&
            this.isoPosition.isoY === isoPosition.isoY &&
            this.isoPosition.elevation === isoPosition.elevation
        ) {
            return;
        }

        this.isoPosition = isoPosition;
        this.updateDepth(
            isoPosition.isoX,
            isoPosition.isoY,
            isoPosition.elevation,
        );
        if (duration != null) {
            this.tween = gsap.to(this, {
                x: isoPosition.isoX,
                y: isoPosition.isoY - isoPosition.elevation,
                duration,
                overwrite: true, // overwrite previous tweens
            });
        } else {
            this.position.set(
                isoPosition.isoX,
                isoPosition.isoY - isoPosition.elevation,
            );
        }
    }

    highlight(highlight: number) {
        console.log("highlight avatar not suported");
    }

    clearHighlight(highlight?: number) {
        console.log("highlight avatar not suported");
    }

    swapVariant(variant: string) {
        console.log("swapVariant avatar not suported");
    }

    destroy(options?: DestroyOptions): void {
        if (this.tween != null) {
            this.tween.kill();
        }
        super.destroy(options);
    }
}

import {
    directionDuration,
    getEntityId,
    getPositionsForPath,
} from "$lib/crossover/utils";
import { actions, type Actions } from "$lib/crossover/world/actions";
import {
    geohashToGridCell,
    gridCellToGeohash,
} from "$lib/crossover/world/utils";
import type {
    EntityType,
    Item,
    Monster,
    PathParams,
    Player,
} from "$lib/server/crossover/redis/entities";
import { gsap } from "gsap";
import type { DestroyOptions } from "pixi.js";
import { Avatar } from "../../avatar/Avatar";
import { calculatePosition, type Position } from "../utils";
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

    public tween: gsap.core.Tween | gsap.core.Timeline | null = null;
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

    private emitPositionUpdate() {
        this.emit("positionUpdate", this.isoPosition);
    }

    private emitTrackEntity(position: Position, duration?: number) {
        this.emit("trackEntity", { position, duration });
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

    async followPath(pathParams: PathParams) {
        const { pthst, pthdur, pthclk, pth } = pathParams;
        const now = Date.now();

        if (pthclk + pthdur > now) {
            const pathPositions = getPositionsForPath(
                // includes start
                geohashToGridCell(pthst),
                pth,
            );

            // Create a timeline for smooth path following
            if (this.tween != null) {
                this.tween.kill();
            }
            this.tween = gsap.timeline({
                onStart: () => {
                    this.triggerAnimation("move");
                },
            });

            // Animate through each position in the path
            let finalPosition: Position | undefined;
            for (const [index, { row, col }] of pathPositions.entries()) {
                const geohash = gridCellToGeohash({
                    row,
                    col,
                    precision: pthst.length,
                });
                const isoPosition = await calculatePosition(geohash);

                // Add tween to the timeline
                this.tween.to(this, {
                    x: isoPosition.isoX,
                    y: isoPosition.isoY - isoPosition.elevation,
                    duration: directionDuration(pth[index]) / 1000,
                    ease: "linear",
                    onComplete: () => {
                        this.isoPosition = isoPosition;
                        this.updateDepth(
                            isoPosition.isoX,
                            isoPosition.isoY,
                            isoPosition.elevation,
                        );
                        this.emitPositionUpdate();
                    },
                });
                finalPosition = isoPosition;
            }

            // Play the timeline
            this.tween = this.tween.play();
            if (finalPosition != null) {
                this.emitTrackEntity(finalPosition, pthdur / 1000);
            }
        }
    }

    updateIsoPosition(isoPosition: Position, duration?: number) {
        // Skip if position is the same
        if (
            this.isoPosition != null &&
            this.isoPosition.isoX === isoPosition.isoX &&
            this.isoPosition.isoY === isoPosition.isoY &&
            this.isoPosition.elevation === isoPosition.elevation
        ) {
            return;
        }

        // Tween position to isoPosition
        if (duration != null) {
            if (this.tween != null) {
                this.tween.kill();
            }
            this.tween = gsap.to(this, {
                x: isoPosition.isoX,
                y: isoPosition.isoY - isoPosition.elevation,
                duration,
                overwrite: true, // overwrite previous tweens
                onComplete: () => {
                    this.isoPosition = isoPosition;
                    this.updateDepth(
                        isoPosition.isoX,
                        isoPosition.isoY,
                        isoPosition.elevation,
                    );
                    this.emitPositionUpdate();
                },
            });
            this.emitTrackEntity(isoPosition, duration);
        }
        // Set position immediately
        else {
            this.isoPosition = isoPosition;
            this.position.set(
                isoPosition.isoX,
                isoPosition.isoY - isoPosition.elevation,
            );
            this.updateDepth(
                isoPosition.isoX,
                isoPosition.isoY,
                isoPosition.elevation,
            );
            this.emitPositionUpdate();
            this.emitTrackEntity(isoPosition);
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

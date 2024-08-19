// EntityContainer.ts
import {
    directionDuration,
    geohashToGridCell,
    getEntityId,
    getPositionsForPath,
    gridCellToGeohash,
} from "$lib/crossover/utils";
import { actions, type Actions } from "$lib/crossover/world/actions";
import type {
    EntityType,
    Item,
    Monster,
    PathParams,
    Player,
} from "$lib/server/crossover/redis/entities";
import { gsap } from "gsap";
import { Container, Graphics, type DestroyOptions } from "pixi.js";
import { calculatePosition, type Position } from "../utils";
import { ActionBubble } from "./ActionBubble";

export class EntityContainer extends Container {
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
        super();

        const [entityId, entityType] = getEntityId(entity);
        this.entityId = entityId;
        this.entityType = entityType;
        this.entity = entity;
        this.zOffset = zOffset ?? 0;
        this.zScale = zScale ?? 0;
        this.renderLayer = renderLayer ?? 1;

        this.actionBubble = new ActionBubble();
        this.addChild(this.actionBubble);

        console.log(this.entityId, this.zOffset);

        this.cullable = true;
    }

    protected emitPositionUpdate() {
        this.emit("positionUpdate", this.isoPosition);
    }

    protected emitTrackEntity(position: Position, duration?: number) {
        this.emit("trackEntity", { position, duration });
    }

    public triggerAnimation(action: string) {
        if (this.actionBubble != null && action in actions) {
            this.actionBubble.setAction(action as Actions);
            if (this.isoPosition) {
                this.actionBubble.updateDepth(this.isoPosition.isoY);
            }
        }
    }

    public debugBoundingBox(): Graphics {
        const bounds = this.getBounds();
        return new Graphics()
            .rect(
                bounds.rectangle.x,
                bounds.rectangle.y,
                bounds.rectangle.width,
                bounds.rectangle.height,
            )
            .stroke({ color: "0xff0000" });
    }

    public debugOrigin() {
        this.addChild(
            new Graphics().circle(0, 0, 5).fill({ color: "0xff0000" }),
        );
    }

    async followPath(pathParams: PathParams) {
        const { pthst, pthdur, pthclk, pth } = pathParams;
        const now = Date.now();

        if (!this.isoPosition) {
            console.warn(`${this.entityId} has no position`);
            return;
        }

        // Avatar is moving
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
                const isoPosition = await calculatePosition(
                    geohash,
                    this.isoPosition.locationType,
                );

                // Add tween to the timeline
                this.tween.to(this, {
                    x: isoPosition.isoX,
                    y: isoPosition.isoY - isoPosition.elevation,
                    duration: directionDuration(pth[index]) / 1000,
                    ease: "linear",
                    onComplete: () => {
                        this.isoPosition = isoPosition;
                        this.updateDepth(isoPosition.isoY);
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

    public updateIsoPosition(isoPosition: Position, duration?: number) {
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
                overwrite: true,
                onComplete: () => {
                    this.isoPosition = isoPosition;
                    this.updateDepth(isoPosition.isoY);
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
            this.updateDepth(isoPosition.isoY);
            this.emitPositionUpdate();
            this.emitTrackEntity(isoPosition);
        }
    }

    public updateDepth(isoY: number): void {
        this.zIndex = this.renderLayer * isoY;
        this.actionBubble.updateDepth(isoY);
    }

    public highlight(highlight: number) {}

    public clearHighlight(highlight?: number) {}

    public swapVariant(variant: string) {}

    public asSpriteContainer(): Container | null {
        return null;
    }

    public destroy(options?: DestroyOptions): void {
        if (this.tween != null) {
            this.tween.kill();
        }
        super.destroy(options);
    }
}

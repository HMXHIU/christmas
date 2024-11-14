// EntityContainer.ts
import type { Actor, EntityType, PathParams } from "$lib/crossover/types";
import {
    directionDuration,
    geohashToGridCell,
    getEntityId,
    getPositionsForPath,
    gridCellToGeohash,
} from "$lib/crossover/utils";
import { type Actions } from "$lib/crossover/world/actions";
import { actions } from "$lib/crossover/world/settings/actions";
import { gsap } from "gsap";
import { clone, cloneDeep } from "lodash-es";
import { Container, type DestroyOptions } from "pixi.js";
import type { Light } from "../../shaders/ambient";
import type { IsoMesh } from "../../shaders/IsoMesh";
import { calculatePosition, type Position } from "../utils";
import { ActionBubble } from "./ActionBubble";

export class EntityContainer extends Container {
    public entityId: string;
    public entityType: EntityType;
    public entity: Actor;

    public depthStart: number = 0;
    public depthScale: number = 0;
    public depthLayer: number = 0;

    public isoPosition: Position | null = null;

    public tween: gsap.core.Tween | gsap.core.Timeline | null = null;
    public actionBubble: ActionBubble;
    public shadow: IsoMesh | null = null;

    constructor({
        entity,
        depthStart,
        depthLayer,
        depthScale,
    }: {
        entity: Actor;
        depthStart: number;
        depthScale: number;
        depthLayer: number;
    }) {
        super();

        const [entityId, entityType] = getEntityId(entity);
        this.entityId = entityId;
        this.entityType = entityType;
        this.entity = entity;
        this.depthStart = depthStart;
        this.depthScale = depthScale;
        this.depthLayer = depthLayer;

        this.actionBubble = new ActionBubble();
        this.addChild(this.actionBubble);

        this.cullable = true;
    }

    public triggerAnimation(action: string) {
        if (this.actionBubble != null && action in actions) {
            this.actionBubble.setAction(action as Actions);
            if (this.isoPosition) {
                this.actionBubble.updateDepth(this.isoPosition.isoY);
            }
        }
    }

    async turnOnShadow() {
        this.shadow = await this.getShadow();
        if (this.shadow) {
            this.addChild(this.shadow);
        }
    }

    public updateNormalMaps(lights: Light[]) {
        // Combine all the lights to a single direction and intensity
        const light = lights[0];

        // Convert the light to local coordinates
        this.updateLight({
            x: light.x - this.x,
            y: light.y - this.y,
            intensity: light.intensity * 1.3, // usually we want it greater than the ambient (top down) intensity as the light is hitting face on
        });
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
            const startPosition = cloneDeep(this.isoPosition);

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
                onComplete: () => {
                    this.emit("pathCompleted");
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
                    this.isoPosition.locationInstance,
                );

                // Add tween to the timeline
                this.tween.to(this, {
                    x: isoPosition.isoX,
                    y: isoPosition.isoY - isoPosition.elevation,
                    duration: directionDuration(pth[index]) / 1000,
                    ease: "linear",
                    onComplete: () => {
                        const oldPosition = clone(this.isoPosition);
                        this.isoPosition = isoPosition;
                        this.updateDepth(isoPosition.isoY);
                        this.emit("positionUpdate", oldPosition, isoPosition);
                    },
                    onUpdate: () => {
                        // Safely kill the timeline if 'this' is destroyed
                        if (!this) {
                            (this as EntityContainer).tween?.kill();
                        }
                    },
                });
                finalPosition = isoPosition;
            }

            // Play the timeline
            this.tween = this.tween.play();
            if (finalPosition != null) {
                this.emit("trackEntity", {
                    startPosition,
                    position: finalPosition,
                    duration: pthdur / 1000,
                });
            }
        }
    }

    public setIsoPosition(isoPosition: Position, duration?: number) {
        // Skip if position is the same
        if (
            this.isoPosition != null &&
            this.isoPosition.isoX === isoPosition.isoX &&
            this.isoPosition.isoY === isoPosition.isoY &&
            this.isoPosition.elevation === isoPosition.elevation
        ) {
            return;
        }

        const startPosition = cloneDeep(this.isoPosition);

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
                    const oldPosition = clone(this.isoPosition);
                    this.isoPosition = isoPosition;
                    this.updateDepth(isoPosition.isoY);
                    this.emit("positionUpdate", oldPosition, isoPosition);
                },
            });
            this.emit("trackEntity", {
                startPosition,
                position: isoPosition,
                duration,
            });
        }
        // Set position immediately
        else {
            const oldPosition = clone(this.isoPosition);
            this.isoPosition = isoPosition;
            this.position.set(
                isoPosition.isoX,
                isoPosition.isoY - isoPosition.elevation,
            );
            this.updateDepth(isoPosition.isoY);
            this.emit("positionUpdate", oldPosition, isoPosition);
            this.emit("trackEntity", { startPosition, position: isoPosition });
        }
    }

    public updateDepth(depth: number): void {
        this.zIndex = this.depthLayer + depth * this.depthScale;
        this.actionBubble.updateDepth(depth);
        if (this.shadow) {
            this.shadow.updateDepth(depth);
        }
    }

    public highlight(highlight: number) {}

    public clearHighlight(highlight?: number) {}

    public swapVariant(variant: string) {}

    public asSpriteContainer(): Container | null {
        return null;
    }

    async getShadow(): Promise<IsoMesh | null> {
        return null;
    }

    public updateLight(light: Light) {}

    public destroy(options?: DestroyOptions): void {
        if (this.tween != null) {
            this.tween.kill();
        }
        super.destroy(options);
    }
}

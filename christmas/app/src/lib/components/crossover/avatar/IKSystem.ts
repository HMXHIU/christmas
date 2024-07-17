import { Point } from "pixi.js";
import { Bone } from "./Bone";
import type { BoneConstraints } from "./types";

function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function addPoints(p1: Point, p2: Point): Point {
  return new Point(p1.x + p2.x, p1.y + p2.y);
}

export function subtractPoints(p1: Point, p2: Point): Point {
  return new Point(p1.x - p2.x, p1.y - p2.y);
}

function magnitude(p: Point): number {
  return Math.sqrt(p.x * p.x + p.y * p.y);
}

function normalize(p: Point, scale: number = 1): Point {
  const len = magnitude(p);
  if (len === 0) return new Point(0, 0);
  return new Point((p.x / len) * scale, (p.y / len) * scale);
}

function normalizeAngle(angle: number): number {
  return ((angle + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
}

function angleDifference(a: number, b: number): number {
  return normalizeAngle(a - b);
}

export class IKSystem {
  private static readonly MAX_ITERATIONS = 10;
  private static readonly DISTANCE_THRESHOLD = 0.1;

  static solve({
    bones,
    effectorBone,
    targetPosition,
    effectorOffset,
    constraints,
  }: {
    bones: Bone[];
    effectorBone: Bone;
    targetPosition: Point;
    effectorOffset: Point;
    constraints?: Record<string, BoneConstraints>;
  }): void {
    // Calculate the total length of the chain (the bones might not be lined up perfectly head to tail)
    let totalLength = 0;
    if (bones.length > 0) {
      for (let i = 1; i < bones.length; i++) {
        totalLength += magnitude(bones[i].position);
      }
      totalLength += bones.slice(-1)[0].boneMetadata.height;
    } else {
      totalLength = bones[0].boneMetadata.height;
    }

    const globalTargetPosition = effectorBone.toGlobal(targetPosition);
    const targetDistance = distance(
      globalTargetPosition,
      bones[0].getGlobalPosition()
    );

    // Check if target is reachable
    if (targetDistance > totalLength) {
      // Target is unreachable, stretch the chain
      this.stretchTowardsTarget(bones, globalTargetPosition);
      return;
    }

    // Iterative IK solver (CCD - Cyclic Coordinate Descent)
    for (let iteration = 0; iteration < this.MAX_ITERATIONS; iteration++) {
      // Calculate the end effector position
      let endEffectorPosition = effectorBone.toGlobal(
        addPoints(
          effectorOffset,
          new Point(effectorBone.boneMetadata.height, 0)
        )
      );

      // Target reached
      if (
        distance(endEffectorPosition, globalTargetPosition) <
        this.DISTANCE_THRESHOLD
      ) {
        break;
      }

      // Iterate through each bone in the chain
      for (let i = bones.length - 1; i >= 0; i--) {
        const bone = bones[i];
        const boneStart = bone.getGlobalPosition();
        const boneToEndEffector = subtractPoints(
          endEffectorPosition,
          boneStart
        );
        const boneToTarget = subtractPoints(globalTargetPosition, boneStart);

        // Calculate the angle to rotate
        const currentAngle = Math.atan2(
          boneToEndEffector.y,
          boneToEndEffector.x
        );
        const targetAngle = Math.atan2(boneToTarget.y, boneToTarget.x);
        let rotationAngle = normalizeAngle(targetAngle - currentAngle);

        // Apply constraint if it exists
        if (constraints && constraints[bone.name]) {
          const constraint = constraints[bone.name];
          const newRotation = normalizeAngle(bone.rotation + rotationAngle);
          const diffFromCenter = angleDifference(
            newRotation,
            constraint.rotation.center
          );

          if (Math.abs(diffFromCenter) > constraint.rotation.range / 2) {
            // Clamp the rotation to the nearest edge of the allowed range
            if (diffFromCenter > 0) {
              rotationAngle = normalizeAngle(
                constraint.rotation.center +
                  constraint.rotation.range / 2 -
                  bone.rotation
              );
            } else {
              rotationAngle = normalizeAngle(
                constraint.rotation.center -
                  constraint.rotation.range / 2 -
                  bone.rotation
              );
            }
          }
        }

        // Update bone rotation
        bone.rotation += rotationAngle;

        // Recalculate end effector position
        endEffectorPosition = effectorBone.toGlobal(
          addPoints(
            effectorOffset,
            new Point(effectorBone.boneMetadata.height, 0)
          )
        );

        // Target reached
        if (
          distance(endEffectorPosition, globalTargetPosition) <
          this.DISTANCE_THRESHOLD
        ) {
          break;
        }
      }
    }
  }

  private static stretchTowardsTarget(
    bones: Bone[],
    globalTargetPosition: Point
  ): void {
    // Update the rotation of the first bone
    let direction = normalize(
      subtractPoints(
        bones[0].parent.toLocal(globalTargetPosition),
        bones[0].position
      )
    );
    bones[0].rotation = Math.atan2(direction.y, direction.x);

    // Update the rotation of the rest of the bones
    if (bones.length > 0) {
      for (let i = 1; i < bones.length; i++) {
        const bone = bones[i];
        direction = normalize(
          subtractPoints(
            bone.parent.toLocal(globalTargetPosition),
            bone.position
          )
        );
        bone.rotation = Math.atan2(direction.y, direction.x);
      }
    }
  }
}

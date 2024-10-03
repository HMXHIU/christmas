import { gsap } from "gsap";
import { cloneDeep } from "lodash-es";
import type { Bone } from "./Bone";
import type {
    Animation,
    AnimationMetadata,
    IKChainData,
    KeyFrame,
    Pose,
} from "./types";

const TWO_PI = Math.PI * 2;
const THREE_PI = Math.PI * 3;

export class AnimationManager {
    public animations: Record<string, Animation> = {};
    public poses: Record<string, Pose> = {};
    public currentAnimation: gsap.core.Timeline | null = null;
    public ikChains: Record<string, IKChainData> = {};
    public currentPose: Pose | null = null;

    load(metadata: AnimationMetadata): void {
        this.animations = cloneDeep(metadata.animations);
        this.poses = cloneDeep(metadata.poses);
        this.ikChains = cloneDeep(metadata.ik.chains);
    }

    deserialize(): AnimationMetadata {
        return {
            ik: { chains: this.ikChains },
            poses: this.poses,
            animations: this.animations,
        };
    }

    getPose(pose: string) {
        return this.poses[pose];
    }

    getPoseBone(bone: string, pose: string) {
        return this.getPose(pose).find((poseBone) => poseBone.bone === bone);
    }

    async pose(pose: Pose, bones: Record<string, Bone>) {
        const offset = Math.round(Object.keys(bones).length / 2);

        // Set bone transforms using the selected pose
        for (const [
            index,
            { bone: boneName, texture, position, rotation, scale },
        ] of pose.entries()) {
            const bone = bones[boneName];
            if (bone) {
                await bone.setTexture(texture);
                bone.position.set(position.x, position.y);
                bone.rotation = rotation;
                bone.scale.set(scale.x, scale.y);
                // Note: `boneRenderLayer` is only known at pose time, but when creating bone
                bone.boneRenderLayer = index;
            }
        }
        this.currentPose = pose;
    }

    async poseAtTime(
        pose: Pose,
        animation: Animation,
        time: number,
        bones: Record<string, Bone>,
    ) {
        // First, apply the initial pose
        await this.pose(pose, bones);

        // Iterate through each bone animation
        for (const boneAnim of animation.bones) {
            const bone = bones[boneAnim.boneName];
            if (!bone) continue;

            // Find the initial pose for this bone
            const initialPoseBone = pose.find(
                (p) => p.bone === boneAnim.boneName,
            );
            if (!initialPoseBone) continue;

            // Handle case with no keyframes
            if (boneAnim.keyframes.length === 0) {
                continue; // Keep initial pose
            }

            // Find the keyframes surrounding the current time
            let poseKf: KeyFrame = {
                time: 0,
                rotation: initialPoseBone.rotation,
                scale: initialPoseBone.scale,
                position: initialPoseBone.position,
            };
            let prevKeyframe = poseKf;
            let nextKeyframe = boneAnim.keyframes[0];
            for (let i = 0; i < boneAnim.keyframes.length; i++) {
                if (boneAnim.keyframes[i].time <= time) {
                    prevKeyframe = boneAnim.keyframes[i];
                    nextKeyframe =
                        boneAnim.keyframes[i + 1] || boneAnim.keyframes[i];
                } else {
                    break;
                }
            }

            // Calculate interpolation factor
            let factor;
            if (prevKeyframe === nextKeyframe) {
                // We're at or past the last keyframe
                factor = 1;
            } else if (prevKeyframe === poseKf) {
                // We're before the first keyframe
                factor = time / nextKeyframe.time;
            } else {
                factor =
                    (time - prevKeyframe.time) /
                    (nextKeyframe.time - prevKeyframe.time);
            }

            // Interpolate bone properties
            interpolateBoneProperties(bone, prevKeyframe, nextKeyframe, factor);
        }
    }

    private createBoneAnimation(
        timeline: gsap.core.Timeline,
        bone: Bone,
        keyframes: KeyFrame[],
        duration: number,
        pose: string,
    ): void {
        if (keyframes.length === 0) return;

        const createTweenVars = (kf: KeyFrame): gsap.TweenVars => ({
            ...(kf.rotation != null && { rotation: kf.rotation }),
            ...(kf.scale != null && {
                pixi: { scaleX: kf.scale.x, scaleY: kf.scale.y },
            }),
            ...(kf.position != null && { x: kf.position.x, y: kf.position.y }),
        });

        const timelineTos = keyframes.map((kf, i) => {
            return {
                tweenVars: createTweenVars(kf),
                bone,
                time: i > 0 ? keyframes[i - 1].time : 0, // start at previous keyframe, this is the target
                duration: i > 0 ? kf.time - keyframes[i - 1].time : kf.time, // duration is the difference between the target and previous keyframe
            };
        });

        // Final keyframe at duration should end at original pose
        const poseBone = this.getPoseBone(bone.name, pose);
        if (poseBone != null) {
            timelineTos.push({
                tweenVars: {
                    rotation: poseBone.rotation,
                    pixi: {
                        scaleX: poseBone.scale.x,
                        scaleY: poseBone.scale.y,
                    },
                    x: poseBone.position.x,
                    y: poseBone.position.y,
                },
                bone,
                time: keyframes[keyframes.length - 1].time,
                duration: duration - keyframes[keyframes.length - 1].time,
            });
        }

        let prevRotation: number | null = poseBone?.rotation ?? null;
        timelineTos.forEach(({ tweenVars, time, duration }) => {
            // Fix rotations (shortest rotation to prevRotation allowing to go past the -pi/pi boundary)
            if (tweenVars.rotation !== undefined && prevRotation !== null) {
                const diff = shortestAngleRotation(
                    prevRotation,
                    tweenVars.rotation as number,
                );
                tweenVars.rotation = prevRotation + diff;
            }
            prevRotation = (tweenVars.rotation as number) ?? prevRotation;
            timeline.to(bone, { duration, ...tweenVars, ease: "none" }, time);
        });
    }

    playAnimation(
        animationName: string,
        bones: Record<string, Bone>,
        loop: boolean = false,
        onComplete?: () => void,
    ): void {
        const animation = this.animations[animationName];

        if (!animation) {
            console.error(`Animation "${animationName}" not found`);
            return;
        }
        this.stopAnimation();

        // Create a timeline for the animation
        const timeline = gsap.timeline({
            repeat: loop ? -1 : 0, // -1 means infinite loop
            onComplete: () => {
                if (!loop) {
                    this.currentAnimation = null;
                    onComplete?.();
                }
            },
            onUpdate: () => {
                if (!this.currentAnimation) {
                    timeline.kill();
                }
            },
        });

        // Create tweens for each bone
        for (const boneAnim of animation.bones) {
            const bone = bones[boneAnim.boneName];
            if (!bone) {
                console.warn(`Bone "${boneAnim.boneName}" not found in avatar`);
                continue;
            }
            this.createBoneAnimation(
                timeline,
                bone,
                boneAnim.keyframes,
                animation.duration,
                animation.pose,
            );
        }

        this.currentAnimation = timeline;
        timeline.play();
    }

    stopAnimation(): void {
        if (this.currentAnimation) {
            this.currentAnimation.kill();
            this.currentAnimation = null;
        }
    }

    getAnimationNames(): string[] {
        return Object.keys(this.animations);
    }

    getAnimation(name: string): Animation | undefined {
        return this.animations[name];
    }

    setAnimation(name: string, animation: Animation): void {
        this.animations[name] = animation;
    }
}

export function timeIndex(time: number | string) {
    return Number(parseFloat(String(time)).toFixed(1));
}

function normalizeAngle(angle: number): number {
    // -π to π
    return ((angle + THREE_PI) % TWO_PI) - Math.PI;
}

function normalizeAngle2Pi(angle: number): number {
    return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
}

function shortestAngleRotation(fromAngle: number, toAngle: number): number {
    // Ensure angles are in the range [0, 2π)
    fromAngle = normalizeAngle2Pi(fromAngle);
    toAngle = normalizeAngle2Pi(toAngle);

    // Calculate the difference
    let diff = toAngle - fromAngle;

    // Normalize the difference to be in the range [-π, π)
    return normalizeAngle(diff);
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
    const diff = normalizeAngle(b - a);
    return a + diff * t;
}

function interpolateBoneProperties(
    bone: Bone,
    start: {
        position?: { x: number; y: number };
        rotation?: number;
        scale?: { x: number; y: number };
    },
    end: {
        position?: { x: number; y: number };
        rotation?: number;
        scale?: { x: number; y: number };
    },
    factor: number,
) {
    // Interpolate position
    if (start.position && end.position) {
        bone.position.x = lerp(start.position.x, end.position.x, factor);
        bone.position.y = lerp(start.position.y, end.position.y, factor);
    }

    // Interpolate rotation
    if (start.rotation !== undefined && end.rotation !== undefined) {
        bone.rotation = lerpAngle(start.rotation, end.rotation, factor);
    }

    // Interpolate scale
    if (start.scale && end.scale) {
        bone.scale.x = lerp(start.scale.x, end.scale.x, factor);
        bone.scale.y = lerp(start.scale.y, end.scale.y, factor);
    }
}

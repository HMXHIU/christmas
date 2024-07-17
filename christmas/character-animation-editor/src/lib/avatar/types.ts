// src/lib/types.ts

export interface BoneTextureTransform {
  anchor: {
    x: number;
    y: number;
  };
  rotation: number;
}

export interface BoneTextures {
  [key: string]: BoneTextureTransform;
}

export interface BoneMetadata {
  bone: string;
  height: number;
  width: number;
  parent?: string;
  textures: BoneTextures;
}

export interface AvatarMetadata {
  bones: Record<string, BoneMetadata>;
  textures: { [key: string]: string };
}

export interface BonePose {
  pose: string;
  bone: string;
  texture: string;
  position: {
    x: number;
    y: number;
  };
  rotation: number;
  scale: {
    x: number;
    y: number;
  };
}

export interface BoneConstraints {
  rotation: {
    center: number;
    range: number;
  };
}

export type Pose = BonePose[];

export interface KeyFrame {
  time: number;
  rotation?: number;
  scale?: {
    x: number;
    y: number;
  };
  position?: {
    x: number;
    y: number;
  };
}

export interface BoneAnimation {
  boneName: string;
  keyframes: KeyFrame[];
}

export interface Animation {
  animation: string;
  duration: number;
  bones: BoneAnimation[];
  pose: string;
}

export interface AnimationMetadata {
  animations: Record<string, Animation>;
  poses: Record<string, Pose>;
  ik: {
    chains: Record<string, IKChainData>;
  };
}

export interface IKEffector {
  boneName: string;
  offset: { x: number; y: number };
}

export interface IKChainData {
  chain: string;
  bones: string[];
  effector: IKEffector;
  constraints: Record<string, BoneConstraints>;
}

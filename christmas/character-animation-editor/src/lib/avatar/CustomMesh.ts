// src/lib/CustomMesh.ts
import { Geometry, Mesh, type MeshOptions, Shader, Texture } from "pixi.js";

export class CustomMesh extends Mesh<Geometry, Shader> {
  constructor(
    texture: Texture,
    width: number,
    height: number,
    zIndex: number = 0
  ) {
    const geometry = CustomMesh.createQuadGeometry(width, height);
    const shader = CustomMesh.createShader(texture, width, height, zIndex);
    const meshOptions: MeshOptions<Geometry, Shader> = {
      geometry,
      shader,
      texture,
    };
    super(meshOptions);
  }

  static createQuadGeometry(width: number, height: number): Geometry {
    return new Geometry({
      attributes: {
        aPosition: [0, 0, width, 0, width, height, 0, height],
        aUV: [0, 0, 1, 0, 1, 1, 0, 1],
      },
      indexBuffer: [0, 1, 2, 2, 3, 0],
    });
  }

  static createShader(
    texture: Texture,
    width: number,
    height: number,
    zIndex: number
  ): Shader {
    return Shader.from({
      gl: {
        vertex: `
          attribute vec2 aPosition;
          attribute vec2 aUV;

          uniform mat3 uProjectionMatrix;
          uniform mat3 uWorldTransformMatrix;
          uniform mat3 uTransformMatrix;
          uniform float uZIndex;

          varying vec2 vUV;

          void main() {
            vUV = aUV;
            mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
            gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, uZIndex, 1.0);
          }
        `,
        fragment: `
          varying vec2 vUV;

          uniform sampler2D uTexture;

          void main() {
            gl_FragColor = texture2D(uTexture, vUV);
          }
        `,
      },
      resources: {
        uTexture: texture.source,
        uniforms: {
          uZIndex: { value: zIndex, type: "f32" },
          uTextureWidth: { value: width, type: "f32" },
          uTextureHeight: { value: height, type: "f32" },
        },
      },
    });
  }

  setZIndex(zIndex: number): void {
    if (this.shader.resources.uZIndex) {
      this.shader.resources.uZIndex.value = zIndex;
    }
  }
}

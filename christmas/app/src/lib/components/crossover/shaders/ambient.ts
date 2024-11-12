import { Container, Geometry, Mesh, Shader, Texture } from "pixi.js";
import { shaders } from ".";
import { layers } from "../Game/layers";

export { AmbientOverlay, type Light };

const MAX_NUM_LIGHTS = 10;

interface Light {
    x: number;
    y: number;
    intensity: number;
}

/**
 * Ambient overlay (darkness, clouds, snow, rain, etc...)
 *
 * Position (x, y):
 *  - Corresponds to the top left
 *  - Should be updated regularly (eg. when the player moves to a new house)
 *
 * Dimensions (width, height):
 *  - Should not change (set at initialization)
 *  - Correspond to real world isometric coordinates
 *  - Should use the same 9 neighbours as the biomes shader (see `drawBiomeShaders`)
 *
 * `updateLights` should be called at every app ticker
 */
class AmbientOverlay extends Container {
    mesh: Mesh<Geometry, Shader> | null = null;

    constructor({ width, height }: { width: number; height: number }) {
        super();

        const { depthStart, depthLayer } = layers.depthPartition("ambient");
        const texture = Texture.EMPTY;
        const { x0, y0, x1, y1, x2, y2, x3, y3 } = texture.uvs;
        const geometry = new Geometry({
            attributes: {
                aPosition: [0, 0, width, 0, width, height, 0, height],
                aUV: [x0, y0, x1, y1, x2, y2, x3, y3],
            },
            indexBuffer: [0, 1, 2, 2, 3, 0],
        });
        const shader = Shader.from({
            gl: {
                vertex: shaders.ambient.vertex,
                fragment: shaders.ambient.fragment,
            },
            resources: {
                uTexture: texture.source,
                uniforms: {
                    uDepthStart: {
                        value: depthStart,
                        type: "f32",
                    },
                    uAmbientLight: {
                        value: 0.3,
                        type: "f32",
                    },
                    uLight0: {
                        value: new Float32Array([0, 0, 0, 0]), // x, y, intensity, highlight
                        type: "vec4<f32>",
                    },
                    uLight1: {
                        value: new Float32Array([0, 0, 0, 0]),
                        type: "vec4<f32>",
                    },
                    uLight2: {
                        value: new Float32Array([0, 0, 0, 0]),
                        type: "vec4<f32>",
                    },
                    uLight3: {
                        value: new Float32Array([0, 0, 0, 0]),
                        type: "vec4<f32>",
                    },
                    uLight4: {
                        value: new Float32Array([0, 0, 0, 0]),
                        type: "vec4<f32>",
                    },
                    uLight5: {
                        value: new Float32Array([0, 0, 0, 0]),
                        type: "vec4<f32>",
                    },
                    uLight6: {
                        value: new Float32Array([0, 0, 0, 0]),
                        type: "vec4<f32>",
                    },
                    uLight7: {
                        value: new Float32Array([0, 0, 0, 0]),
                        type: "vec4<f32>",
                    },
                    uLight8: {
                        value: new Float32Array([0, 0, 0, 0]),
                        type: "vec4<f32>",
                    },
                    uLight9: {
                        value: new Float32Array([0, 0, 0, 0]),
                        type: "vec4<f32>",
                    },
                },
            },
        });

        this.mesh = new Mesh<Geometry, Shader>({
            geometry,
            shader,
        });
        this.mesh.width = width;
        this.mesh.height = height;
        this.zIndex = depthLayer;
        this.mesh.zIndex = depthLayer;

        this.addChild(this.mesh);
    }

    updateLights(lights: Light[]) {
        if (this.mesh && this.mesh.shader) {
            for (let i = 0; i < MAX_NUM_LIGHTS; i++) {
                const light = lights[i];
                if (light) {
                    // Get the light position in local coordinates
                    const localX = light.x - this.x;
                    const localY = light.y - this.y;
                    if (
                        localX > 0 &&
                        localX < this.width &&
                        localY > 0 &&
                        localY < this.height
                    ) {
                        // console.log([
                        //     localX,
                        //     localY,
                        //     light.intensity,
                        //     1, // highlight
                        // ]);
                        this.mesh.shader.resources.uniforms.uniforms[
                            `uLight${i}`
                        ] = new Float32Array([
                            localX,
                            localY,
                            light.intensity,
                            1, // highlight
                        ]);
                    }
                } else {
                    this.mesh.shader.resources.uniforms.uniforms[`uLight${i}`] =
                        new Float32Array([-1, -1, -1, -1]);
                }
            }
        }
    }
}

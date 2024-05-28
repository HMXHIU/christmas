import { Buffer, BufferUsage, Geometry, Mesh, Shader, Texture } from "pixi.js";
import biomeFrag from "./biome.frag?raw";
import biomeVertex from "./biome.vert?raw";
import grassFrag from "./grass.frag?raw";
import grassVertex from "./grass.vert?raw";
import snoise from "./lygia/generative/snoise.glsl?raw";
import grad4 from "./lygia/math/grad4.glsl?raw";
import mod289 from "./lygia/math/mod289.glsl?raw";
import permute from "./lygia/math/permute.glsl?raw";
import remap from "./lygia/math/remap.glsl?raw";
import taylorInvSqrt from "./lygia/math/taylorInvSqrt.glsl?raw";

export {
    MAX_SHADER_GEOMETRIES,
    createShader,
    createTexturedQuadGeometry,
    loadShaderGeometry,
    shaders,
    updateShaderUniforms,
};

const MAX_SHADER_GEOMETRIES = 1000;

// So that we can reuse
const loadedShaders: Record<string, Shader> = {};
const loadedGeometry: Record<
    string,
    {
        geometry: Geometry;
        instanceCount?: number;
        instancePositions?: Buffer;
        mesh?: Mesh<Geometry, Shader>;
    }
> = {};

const shaders: Record<string, { vertex: string; fragment: string }> = {
    grass: {
        vertex: `
        ${mod289}
        ${grad4}
        ${permute}
        ${taylorInvSqrt}
        ${snoise}
        ${remap}
        ${grassVertex}
        `,
        fragment: grassFrag,
    },
    biome: {
        vertex: biomeVertex,
        fragment: biomeFrag,
    },
};

function updateShaderUniforms({ deltaTime }: { deltaTime: number }) {
    for (const shader of Object.values(loadedShaders)) {
        shader.resources.uniforms.uniforms.uTime += deltaTime;
    }
}

function loadShaderGeometry(
    s: string,
    texture: Texture,
    width: number,
    height: number,
    instanceCount?: number,
): [
    Shader,
    {
        geometry: Geometry;
        instanceCount?: number;
        instancePositions?: Buffer;
        mesh?: Mesh<Geometry, Shader>; // instanced geometry share a single mesh
    },
] {
    instanceCount ??= 1;
    const shader = loadedShaders[s];
    const geometry = loadedGeometry[texture.uid];

    if (shader && geometry) {
        return [shader, geometry];
    }

    if (shader == null) {
        loadedShaders[s] = createShader(s, texture);
    }

    if (geometry == null) {
        if (instanceCount > 1) {
            const [geometry, instancePositions] =
                createInstancedTexturedQuadGeometry(
                    texture,
                    instanceCount,
                    width,
                    height,
                );

            const mesh = new Mesh<Geometry, Shader>({
                geometry,
                shader: loadedShaders[s]!,
            });

            loadedGeometry[texture.uid] = {
                geometry,
                instanceCount,
                instancePositions,
                mesh,
            };
        } else {
            loadedGeometry[texture.uid] = {
                geometry: createTexturedQuadGeometry(texture, width, height),
            };
        }
    }

    return [loadedShaders[s], loadedGeometry[texture.uid]];
}

function createShader(s: string, texture: Texture): Shader {
    const { height, width } = texture.frame;
    const { x: anchorX, y: anchorY } = texture.defaultAnchor || { x: 0, y: 0 };

    return Shader.from({
        gl: shaders[s],
        resources: {
            uTexture: texture.source,
            uniforms: {
                uCx: {
                    value: width * anchorX,
                    type: "f32",
                },
                uCy: {
                    value: height * anchorY,
                    type: "f32",
                },
                uTime: {
                    value: 0,
                    type: "f32",
                },
                uTextureHeight: {
                    value: height,
                    type: "f32",
                },
                uTextureWidth: {
                    value: width,
                    type: "f32",
                },
            },
        },
    });
}

function createTexturedQuadGeometry(
    texture: Texture,
    width: number,
    height: number,
): Geometry {
    const { x0, y0, x1, y1, x2, y2, x3, y3 } = texture.uvs;

    return new Geometry({
        attributes: {
            aPosition: [
                // tl
                0,
                0,
                // tr
                width,
                0,
                // br
                width,
                height,
                // bl
                0,
                height,
            ],
            aUV: [x0, y0, x1, y1, x2, y2, x3, y3],
        },
        indexBuffer: [0, 1, 2, 2, 3, 0], // quad
    });
}

function createInstancedTexturedQuadGeometry(
    texture: Texture,
    instanceCount: number,
    width: number,
    height: number,
): [Geometry, Buffer] {
    const { x0, y0, x1, y1, x2, y2, x3, y3 } = texture.uvs;

    if (instanceCount < 1) {
        throw new Error("Instance count must be greater than 0");
    }

    const instancePositions = new Buffer({
        data: new Float32Array(instanceCount * 3), // x, y, z
        usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
    });

    return [
        new Geometry({
            attributes: {
                aPosition: [
                    // tl
                    0,
                    0,
                    // tr
                    width,
                    0,
                    // br
                    width,
                    height,
                    // bl
                    0,
                    height,
                ],
                aUV: [x0, y0, x1, y1, x2, y2, x3, y3],
                aInstancePosition: {
                    buffer: instancePositions,
                    instance: true,
                    size: 3,
                },
            },
            indexBuffer: [0, 1, 2, 2, 3, 0], // quad
            instanceCount,
        }),
        instancePositions,
    ];
}

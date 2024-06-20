import { Buffer, BufferUsage, Geometry, Mesh, Shader, Texture } from "pixi.js";
import biomeFrag from "./biome.frag?raw";
import biomeVertex from "./biome.vert?raw";
import entityFrag from "./entity.frag?raw";
import entityVertex from "./entity.vert?raw";
import grassFrag from "./grass.frag?raw";
import grassVertex from "./grass.vert?raw";
import iconFrag from "./icon.frag?raw";
import iconVertex from "./icon.vert?raw";
import snoise from "./lygia/generative/snoise.glsl?raw";
import grad4 from "./lygia/math/grad4.glsl?raw";
import mod289 from "./lygia/math/mod289.glsl?raw";
import permute from "./lygia/math/permute.glsl?raw";
import remap from "./lygia/math/remap.glsl?raw";
import taylorInvSqrt from "./lygia/math/taylorInvSqrt.glsl?raw";

export {
    MAX_SHADER_GEOMETRIES,
    clearShaderCache,
    createShader,
    createTexturedQuadGeometry,
    loadShaderGeometry,
    loadedGeometry,
    shaders,
    updateShaderUniforms,
};

const MAX_SHADER_GEOMETRIES = 1000;

// So that we can reuse
const loadedShaders: Record<string, Shader> = {};
const loadedGeometry: Record<
    string,
    {
        shader: string;
        geometry: Geometry;
        instanceCount: number;
        instancePositions: Buffer;
        instanceHighlights: Buffer;
        mesh: Mesh<Geometry, Shader>;
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
    entity: {
        vertex: entityVertex,
        fragment: entityFrag,
    },
    icon: {
        vertex: iconVertex,
        fragment: iconFrag,
    },
    world: {
        vertex: entityVertex,
        fragment: entityFrag,
    },
};

function clearShaderCache() {
    for (const [key, value] of Object.entries(loadedShaders)) {
        value.destroy();
        delete loadedShaders[key];
    }

    for (const [key, value] of Object.entries(loadedGeometry)) {
        value.geometry.destroy();
        value.instancePositions.destroy();
        value.mesh.destroy();
        delete loadedGeometry[key];
    }
}

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
    options: {
        instanceCount?: number;
        uid?: string;
        anchor?: { x: number; y: number };
        zScale?: number;
        zOffset?: number;
        cellHeight?: number;
    } = {},
): [
    Shader,
    {
        geometry: Geometry;
        instanceCount?: number;
        instancePositions: Buffer;
        instanceHighlights: Buffer;
        mesh: Mesh<Geometry, Shader>; // instanced geometry share a single mesh
    },
] {
    const instanceCount = options.instanceCount ?? 1;
    const shaderUid = `${s}-${options.uid ?? texture.uid}`;
    const shader = loadedShaders[shaderUid];
    const geometry = loadedGeometry[shaderUid];

    if (shader && geometry) {
        return [shader, geometry];
    }

    if (shader == null) {
        loadedShaders[shaderUid] = createShader(s, texture, {
            height,
            width,
            anchor: options.anchor,
            zScale: options.zScale,
            zOffset: options.zOffset,
        });
    }

    if (geometry == null) {
        const { geometry, instancePositions, instanceHighlights } =
            instanceCount > 1
                ? createInstancedTexturedQuadGeometry(
                      texture,
                      instanceCount,
                      width,
                      height,
                      options.cellHeight,
                  )
                : createTexturedQuadGeometry(
                      texture,
                      width,
                      height,
                      options.cellHeight,
                  );
        loadedGeometry[shaderUid] = {
            shader: s,
            geometry,
            instanceCount,
            mesh: new Mesh<Geometry, Shader>({
                geometry,
                shader: loadedShaders[shaderUid]!,
            }),
            instancePositions,
            instanceHighlights,
        };
    }

    return [loadedShaders[shaderUid], loadedGeometry[shaderUid]];
}

function createShader(
    s: string,
    texture: Texture,
    instanceOptions?: {
        height?: number;
        width?: number;
        anchor?: { x: number; y: number };
        zScale?: number;
        zOffset?: number;
    },
): Shader {
    const height = instanceOptions?.height ?? texture.frame.height;
    const width = instanceOptions?.width ?? texture.frame.width;
    const anchor = instanceOptions?.anchor ??
        texture.defaultAnchor ?? { x: 0.5, y: 0.5 };
    const zScale = instanceOptions?.zScale ?? 0;
    const zOffset = instanceOptions?.zOffset ?? 0;

    return Shader.from({
        gl: shaders[s],
        resources: {
            uTexture: texture.source,
            uniforms: {
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
                uAnchorX: {
                    value: anchor.x * width,
                    type: "f32",
                },
                uAnchorY: {
                    value: anchor.y * height,
                    type: "f32",
                },
                uZScale: {
                    value: zScale,
                    type: "f32",
                },
                uZOffset: {
                    value: zOffset,
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
    cellHeight?: number,
): {
    geometry: Geometry;
    instancePositions: Buffer;
    instanceHighlights: Buffer;
} {
    const { x0, y0, x1, y1, x2, y2, x3, y3 } = texture.uvs;
    const instancePositions = new Buffer({
        data: new Float32Array(3).fill(-1), // x, y, h
        usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
    });
    const instanceHighlights = new Buffer({
        data: new Float32Array(1).fill(0),
        usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
    });

    const zAlongY = cellHeight
        ? [1, 1, 1, 1, 1, 1, 1, 1]
        : [0, 0, 0, 0, 0, 0, 0, 0];

    return {
        geometry: new Geometry({
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
                aZAlongY: zAlongY,
                aInstancePosition: {
                    buffer: instancePositions,
                    instance: true, // ??? 'Vertex buffer is not big enough for the draw call' if false
                },
                aInstanceHighlight: {
                    buffer: instanceHighlights,
                    instance: true,
                },
            },
            indexBuffer: [0, 1, 2, 2, 3, 0], // quad
        }),
        instancePositions,
        instanceHighlights,
    };
}

function createInstancedTexturedQuadGeometry(
    texture: Texture,
    instanceCount: number,
    width: number,
    height: number,
    cellHeight?: number,
): {
    geometry: Geometry;
    instancePositions: Buffer;
    instanceHighlights: Buffer;
} {
    const { x0, y0, x1, y1, x2, y2, x3, y3 } = texture.uvs;

    if (instanceCount < 1) {
        throw new Error("Instance count must be greater than 0");
    }

    const instancePositions = new Buffer({
        data: new Float32Array(instanceCount * 3), // x, y, h
        usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
    });

    const instanceHighlights = new Buffer({
        data: new Float32Array(instanceCount).fill(0),
        usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
    });

    const zAlongY = cellHeight
        ? [1, 1, 1, 1, 1, 1, 1, 1]
        : [0, 0, 0, 0, 0, 0, 0, 0];

    return {
        geometry: new Geometry({
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
                aZAlongY: zAlongY,
                aInstancePosition: {
                    buffer: instancePositions,
                    instance: true,
                },
                aInstanceHighlight: {
                    buffer: instanceHighlights,
                    instance: true,
                },
            },
            indexBuffer: [0, 1, 2, 2, 3, 0], // quad
            instanceCount,
        }),
        instancePositions,
        instanceHighlights,
    };
}

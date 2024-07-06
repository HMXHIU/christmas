import {
    Buffer,
    BufferUsage,
    Container,
    Geometry,
    Mesh,
    Shader,
    Texture,
} from "pixi.js";
import { destroyContainer, Z_SCALE } from "../Game/utils";
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
import mapVertex from "./map.vert?raw";
import mapFrag from "./map2.frag?raw";

export {
    clearInstancedShaderMeshes,
    createShader,
    createTexturedQuadGeometry,
    destroyShaderGeometry,
    destroyShaders,
    drawShaderTextures,
    highlightShaderInstances,
    loadedShaderGeometries,
    loadShaderGeometry,
    MAX_SHADER_GEOMETRIES,
    shaders,
    updateShaderUniforms,
    type ShaderGeometry,
    type ShaderTexture,
};

const MAX_SHADER_GEOMETRIES = 2000;

interface ShaderGeometry {
    shaderUid: string;
    shaderName: string;
    shader: Shader;
    geometry: Geometry;
    instanceCount: number;
    instancePositions: Buffer;
    instanceHighlights: Buffer;
}

interface ShaderTexture {
    texture: Texture;
    positions: Float32Array;
    uvsX?: Float32Array;
    uvsY?: Float32Array;
    sizes?: Float32Array;
    anchors?: Float32Array;
    width: number;
    height: number;
    instances: number;
}

let instancedShaderMeshes: Record<string, Mesh<Geometry, Shader>> = {};

const loadedShaderGeometries: Record<string, ShaderGeometry> = {};

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
    map: {
        vertex: mapVertex,
        fragment: mapFrag,
    },
};

function destroyShaderGeometry(shaderUid: string) {
    if (loadedShaderGeometries[shaderUid] != null) {
        loadedShaderGeometries[shaderUid].instancePositions.destroy();
        loadedShaderGeometries[shaderUid].instanceHighlights.destroy();
        loadedShaderGeometries[shaderUid].geometry.destroy();
        loadedShaderGeometries[shaderUid].shader.destroy();
        delete loadedShaderGeometries[shaderUid];
    }
}

function destroyShaders() {
    for (const shaderUid of Object.keys(loadedShaderGeometries)) {
        destroyShaderGeometry(shaderUid);
    }
}

function updateShaderUniforms({ deltaTime }: { deltaTime: number }) {
    for (const shaderGeometry of Object.values(loadedShaderGeometries)) {
        shaderGeometry.shader.resources.uniforms.uniforms.uTime += deltaTime;
    }
}

function loadShaderGeometry(
    shaderName: string,
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
        textures?: Record<string, Texture>;
    } = {},
): ShaderGeometry {
    const instanceCount = options.instanceCount ?? 1;
    const shaderUid = `${shaderName}-${options.uid ?? texture.uid}`;
    const shaderGeometry = loadedShaderGeometries[shaderUid];

    if (shaderGeometry == null) {
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

        loadedShaderGeometries[shaderUid] = {
            shaderUid,
            shaderName,
            instanceCount,
            instancePositions,
            instanceHighlights,
            shader: createShader(shaderName, texture, {
                height,
                width,
                anchor: options.anchor,
                zScale: options.zScale,
                zOffset: options.zOffset,
                textures: options.textures,
            }),
            geometry,
        };
    }

    return loadedShaderGeometries[shaderUid];
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
        textures?: Record<string, Texture>;
    },
): Shader {
    const height = instanceOptions?.height ?? texture.frame.height;
    const width = instanceOptions?.width ?? texture.frame.width;
    const anchor = instanceOptions?.anchor ??
        texture.defaultAnchor ?? { x: 0.5, y: 0.5 };
    const zScale = instanceOptions?.zScale ?? 0;
    const zOffset = instanceOptions?.zOffset ?? 0;

    const resources: any = {
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
    };

    if (instanceOptions?.textures) {
        for (const [name, texture] of Object.entries(
            instanceOptions.textures,
        )) {
            resources[name] = texture.source;
        }
    }

    return Shader.from({
        gl: shaders[s],
        resources,
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
    instanceXUVs: Buffer;
    instanceYUVs: Buffer;
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

    const instanceSizes = new Buffer({
        data: new Float32Array(instanceCount * 2), // w, h
        usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
    });

    const instanceAnchors = new Buffer({
        data: new Float32Array(instanceCount * 2), // x, y
        usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
    });

    const instanceXUVs = new Buffer({
        data: new Float32Array(instanceCount * 4), // x0, x1, x2, x3
        usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
    });
    const instanceYUVs = new Buffer({
        data: new Float32Array(instanceCount * 4), // y0, y1, y2, y3
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
                aInstanceVertIndex: [0, 1, 2, 3],
                aInstanceSize: {
                    buffer: instanceSizes,
                    instance: true,
                },
                aInstanceAnchor: {
                    buffer: instanceAnchors,
                    instance: true,
                },
                aInstanceXUV: {
                    buffer: instanceXUVs,
                    instance: true,
                },
                aInstanceYUV: {
                    buffer: instanceYUVs,
                    instance: true,
                },
            },
            indexBuffer: [0, 1, 2, 2, 3, 0], // quad
            instanceCount,
        }),
        instancePositions,
        instanceHighlights,
        instanceXUVs,
        instanceYUVs,
    };
}

function sortInstancePositions(
    array: Float32Array,
    instances: number,
): [Float32Array, number[]] {
    // Create an array of objects
    const points: { x: number; y: number; h: number; i: number }[] = [];
    for (let i = 0; i < instances; i += 1) {
        const st = i * 3;
        points.push({ x: array[st], y: array[st + 1], h: array[st + 2], i });
    }

    // Sort the array of objects by y value
    points.sort((a, b) => a.y - b.y);

    // Flatten the sorted array of objects back into the original format
    for (let i = 0; i < points.length; i++) {
        const st = i * 3;
        array[st] = points[i].x;
        array[st + 1] = points[i].y;
        array[st + 2] = points[i].h;
    }

    return [array, points.map(({ i }) => i)];
}

async function drawShaderTextures({
    shaderName,
    shaderTextures,
    renderOrder,
    numGeometries,
    stage,
}: {
    shaderName: string;
    shaderTextures: Record<string, ShaderTexture>;
    renderOrder: number;
    numGeometries: number;
    stage: Container;
}) {
    for (const [
        textureUid,
        {
            texture,
            positions,
            width,
            height,
            instances,
            uvsX,
            uvsY,
            sizes,
            anchors,
        },
    ] of Object.entries(shaderTextures)) {
        const { shader, geometry, instancePositions } = loadShaderGeometry(
            shaderName,
            texture,
            width,
            height,
            {
                instanceCount: numGeometries,
                zScale: Z_SCALE,
            },
        );

        // Set geometry instance count
        geometry.instanceCount = instances;

        // Update instance positions buffer
        if (instancePositions && positions != null) {
            // Sort the positions by y in place
            const [_, sortedIndices] = sortInstancePositions(
                positions,
                instances,
            );
            instancePositions.data.set(positions);
            instancePositions.update();

            // Update instance uvs
            const instanceXUVs = geometry.getBuffer("aInstanceXUV");
            const instanceYUVs = geometry.getBuffer("aInstanceYUV");
            if (
                instanceXUVs != null &&
                instanceYUVs !== null &&
                uvsX != null &&
                uvsY != null
            ) {
                // Sort using sortedIndices
                for (let i = 0; i < sortedIndices.length; i++) {
                    const s = i * 4;
                    const t = sortedIndices[i] * 4;
                    instanceXUVs.data[s] = uvsX[t];
                    instanceXUVs.data[s + 1] = uvsX[t + 1];
                    instanceXUVs.data[s + 2] = uvsX[t + 2];
                    instanceXUVs.data[s + 3] = uvsX[t + 3];
                    instanceYUVs.data[s] = uvsY[t];
                    instanceYUVs.data[s + 1] = uvsY[t + 1];
                    instanceYUVs.data[s + 2] = uvsY[t + 2];
                    instanceYUVs.data[s + 3] = uvsY[t + 3];
                }
                instanceXUVs.update();
                instanceYUVs.update();
            }

            // Update instance sizes
            const instanceSizes = geometry.getBuffer("aInstanceSize");
            if (instanceSizes != null && sizes != null) {
                for (let i = 0; i < sortedIndices.length; i++) {
                    const s = i * 2;
                    const t = sortedIndices[i] * 2;
                    instanceSizes.data[s] = sizes[t];
                    instanceSizes.data[s + 1] = sizes[t + 1];
                }
                // instanceSizes.data.set(sizes);
                instanceSizes.update();
            }

            // Update instance anchors
            const instanceAnchors = geometry.getBuffer("aInstanceAnchor");
            if (instanceAnchors != null && anchors != null) {
                for (let i = 0; i < sortedIndices.length; i++) {
                    const s = i * 2;
                    const t = sortedIndices[i] * 2;
                    instanceAnchors.data[s] = anchors[t];
                    instanceAnchors.data[s + 1] = anchors[t + 1];
                }
                // instanceAnchors.data.set(anchors);
                instanceAnchors.update();
            }
        }

        // Create mesh
        const meshUid = `${shaderName}-${textureUid}`;
        if (instancedShaderMeshes[meshUid] == null) {
            const mesh = new Mesh<Geometry, Shader>({ geometry, shader });
            mesh.zIndex = renderOrder;
            instancedShaderMeshes[meshUid] = mesh;
            stage.addChild(mesh);
        }
    }
}

function highlightShaderInstances(
    shader: string,
    highlightPositions: Record<string, number>, // {'x,y': highlight}
) {
    for (const {
        shaderName,
        instanceHighlights,
        instancePositions,
    } of Object.values(loadedShaderGeometries)) {
        if (shader === shaderName) {
            // Iterate `instancePositions` and compare with `highlightPositions`
            for (let i = 0; i < instanceHighlights.data.length; i += 1) {
                const p = i * 3;
                const x = instancePositions.data[p];
                const y = instancePositions.data[p + 1];
                instanceHighlights.data[i] =
                    highlightPositions[`${x},${y}`] ?? 0;
            }
            instanceHighlights.update();
        }
    }
}

function clearInstancedShaderMeshes(stage: Container) {
    for (const mesh of Object.values(instancedShaderMeshes)) {
        destroyContainer(mesh);
    }
    instancedShaderMeshes = {};
}

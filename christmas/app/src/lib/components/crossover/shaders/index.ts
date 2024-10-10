import {
    Buffer,
    BufferUsage,
    Container,
    Geometry,
    Mesh,
    Shader,
    Texture,
} from "pixi.js";
import biomeFrag from "./instanced/biome.frag?raw";
import biomeVertex from "./instanced/biome.vert?raw";
import grassFrag from "./instanced/grass.frag?raw";
import grassVertex from "./instanced/grass.vert?raw";
import snoise from "./lygia/generative/snoise.glsl?raw";
import grad4 from "./lygia/math/grad4.glsl?raw";
import mod289 from "./lygia/math/mod289.glsl?raw";
import permute from "./lygia/math/permute.glsl?raw";
import remap from "./lygia/math/remap.glsl?raw";
import taylorInvSqrt from "./lygia/math/taylorInvSqrt.glsl?raw";
import entityFrag from "./singular/entity.frag?raw";
import entityVertex from "./singular/entity.vert?raw";
import iconFrag from "./singular/icon.frag?raw";
import iconVertex from "./singular/icon.vert?raw";
import mapFrag from "./singular/map.frag?raw";
import mapVertex from "./singular/map.vert?raw";

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
    swapMeshTexture,
    updateShaderUniforms,
    type OptionalShaderTexture,
    type OptionalShaderTextures,
    type ShaderGeometry,
    type ShaderTexture,
};

const MAX_SHADER_GEOMETRIES = 2000;

interface ShaderGeometry {
    shaderGeometryUid: string;
    shaderName: string;
    shader: Shader;
    geometry: Geometry;
    instanceCount: number;
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

type OptionalShaderTexture = { texture: Texture; enabled: number };
type OptionalShaderTextures = Record<string, OptionalShaderTexture>;

let instancedShaderMeshes: Record<string, Mesh<Geometry, Shader>> = {};

const loadedShaderGeometries: Record<string, ShaderGeometry> = {};
const loadedShaders: Record<string, Shader> = {};
const loadedGeometries: Record<string, Geometry> = {};

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

function destroyShaderGeometry(shaderGeometryUid: string) {
    if (loadedShaderGeometries[shaderGeometryUid] != null) {
        // Remove the references let the garbage collector handle the rest
        delete loadedShaderGeometries[shaderGeometryUid];
    }
}

function destroyShaders() {
    for (const shaderGeometryUid of Object.keys(loadedShaderGeometries)) {
        destroyShaderGeometry(shaderGeometryUid);
    }
}

function clearInstancedShaderMeshes() {
    for (const mesh of Object.values(instancedShaderMeshes)) {
        mesh.destroy();
    }
    instancedShaderMeshes = {};
}

function updateShaderUniforms({ deltaTime }: { deltaTime?: number }) {
    for (const shaderGeometry of Object.values(loadedShaderGeometries)) {
        if (deltaTime != null) {
            shaderGeometry.shader.resources.uniforms.uniforms.uTime +=
                deltaTime;
        }
    }
}

function swapMeshTexture(
    mesh: Mesh<Geometry, Shader>,
    texture: Texture,
    overlay: boolean = false,
) {
    if (mesh.shader == null) {
        console.error("Missing shader for mesh");
        return;
    }

    if (overlay) {
        mesh.shader.resources.uOverlayTexture = texture.source;
    } else {
        mesh.shader.resources.uTexture = texture.source;
    }

    const { x0, y0, x1, y1, x2, y2, x3, y3 } = texture.uvs;
    const uvBuffer = mesh.geometry.getBuffer("aUV");
    uvBuffer.data.set([x0, y0, x1, y1, x2, y2, x3, y3]);
    uvBuffer.update();
}

function loadShaderGeometry(
    {
        shaderName,
        texture,
        width,
        height,
        depthScale,
        depthStart,
        geometryUid,
    }: {
        shaderName: string;
        texture: Texture;
        width: number;
        height: number;
        depthStart: number;
        depthScale: number;
        geometryUid: string; // use the texture.uid for instanced geometry (only 1 geometry)
    },
    options: {
        instanceCount?: number;
        cellHeight?: number;
        textures?: OptionalShaderTextures; // set any other textures here
    } = {},
): ShaderGeometry {
    const instanceCount = options.instanceCount ?? 1;
    const shaderUid = `${shaderName}-${texture.uid}`;
    const shaderGeometryUid = `${shaderUid}-${geometryUid}`;
    const shaderGeometry = loadedShaderGeometries[shaderGeometryUid];

    if (shaderGeometry == null) {
        // Get or create geometry
        let geometry = loadedGeometries[geometryUid];
        if (!geometry) {
            geometry =
                instanceCount > 1
                    ? createInstancedTexturedQuadGeometry(instanceCount)
                    : createTexturedQuadGeometry(
                          texture,
                          width,
                          height,
                          options.cellHeight,
                      );
            loadedGeometries[geometryUid] = geometry;
        }

        /* Get or create shader
        Must use shaderGeometryUid as each entity must have its own shader,
        this is because texture is tied to the shader,
        thus it cannot be shared among different entities
        */
        let shader = loadedShaders[shaderGeometryUid];
        if (!shader) {
            shader = createShader(
                {
                    shaderName,
                    texture,
                    depthScale: depthScale,
                    depthStart: depthStart,
                },
                {
                    height,
                    width,
                    textures: options.textures,
                },
            );
            loadedShaders[shaderGeometryUid] = shader;
        }

        loadedShaderGeometries[shaderGeometryUid] = {
            shaderGeometryUid,
            shaderName,
            instanceCount,
            shader,
            geometry,
        };
    }

    return loadedShaderGeometries[shaderGeometryUid];
}

function createShader(
    {
        shaderName,
        depthScale,
        depthStart,
        texture,
    }: {
        shaderName: string;
        depthStart: number;
        depthScale: number;
        texture: Texture;
    },
    options?: {
        height?: number;
        width?: number;
        textures?: OptionalShaderTextures; // set any other textures here
    },
): Shader {
    const height = options?.height ?? texture.frame.height;
    const width = options?.width ?? texture.frame.width;
    const resources: any = {
        uTexture: texture.source,
        uOverlayTexture: Texture.WHITE.source,
        uniforms: {
            uTime: {
                value: 0,
                type: "f32",
            },
            uTint: {
                value: new Float32Array([0, 0, 0, 0]),
                type: "vec4<f32>",
            },
            uTextureHeight: {
                value: height,
                type: "f32",
            },
            uTextureWidth: {
                value: width,
                type: "f32",
            },
            uDepthStart: {
                value: depthStart,
                type: "f32",
            },
            uDepthScale: {
                value: depthScale,
                type: "f32",
            },
            uOverlayTextureEnabled: {
                value: 0,
                type: "f32",
            },
        },
    };

    if (options?.textures != null) {
        for (const [name, { texture, enabled }] of Object.entries(
            options.textures,
        )) {
            resources[name] = texture.source; // Add texture source
            resources.uniforms[`${name}Enabled`] = {
                value: enabled,
                type: "f32",
            }; // Add texture flag
        }
    }

    return Shader.from({
        gl: shaders[shaderName],
        resources,
    });
}

function createTexturedQuadGeometry(
    texture: Texture,
    width: number,
    height: number,
    cellHeight?: number,
): Geometry {
    cellHeight = cellHeight ?? 1;
    const { x0, y0, x1, y1, x2, y2, x3, y3 } = texture.uvs;
    const instancePositions = new Buffer({
        data: new Float32Array(3).fill(-1), // x, y, h
        usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
    });
    const instanceHighlights = new Buffer({
        data: new Float32Array(1).fill(0),
        usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
    });
    const zAlongY =
        cellHeight > 1 ? [1, 1, 1, 1, 1, 1, 1, 1] : [0, 0, 0, 0, 0, 0, 0, 0];

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
    });
}

function createInstancedTexturedQuadGeometry(instanceCount: number): Geometry {
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

    return new Geometry({
        attributes: {
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
    });
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
    numGeometries,
    stage,
    depthScale,
    depthStart,
    depthLayer,
}: {
    shaderName: string;
    shaderTextures: Record<string, ShaderTexture>;
    numGeometries: number;
    stage: Container;
    depthStart: number;
    depthScale: number;
    depthLayer: number;
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
        const { shader, geometry } = loadShaderGeometry(
            {
                shaderName,
                texture,
                width,
                height,
                depthScale,
                depthStart,
                geometryUid: textureUid,
            },
            {
                instanceCount: numGeometries,
            },
        );

        // Set geometry instance count
        geometry.instanceCount = instances;
        const instancePositions = geometry.getBuffer("aInstancePosition");

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
                instanceAnchors.update();
            }
        }

        // Create mesh
        const meshUid = `${shaderName}-${textureUid}`;
        if (instancedShaderMeshes[meshUid] == null) {
            const mesh = new Mesh<Geometry, Shader>({ geometry, shader });
            mesh.zIndex = depthLayer;
            instancedShaderMeshes[meshUid] = mesh;
            stage.addChild(mesh);
        }
    }
}

function highlightShaderInstances(
    shader: string,
    highlightPositions: Record<string, number>, // {'x,y': highlight}
) {
    for (const { shaderName, geometry } of Object.values(
        loadedShaderGeometries,
    )) {
        if (shader === shaderName) {
            const instancePositions = geometry.getBuffer("aInstancePosition");
            const instanceHighlights = geometry.getBuffer("aInstanceHighlight");
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

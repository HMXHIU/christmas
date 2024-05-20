import {
    Buffer,
    BufferUsage,
    Geometry,
    Matrix,
    Mesh,
    Shader,
    Texture,
} from "pixi.js";
import grassFrag from "./grass.frag?raw";
import grassVertex from "./grass.vert?raw";

export {
    createShader,
    createTexturedQuadGeometry,
    loadShaderGeometry,
    shaders,
    updateShaderWorldTransform,
};

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
        vertex: grassVertex,
        fragment: grassFrag,
    },
};

function updateShaderWorldTransform(t: Matrix) {
    for (const shader of Object.values(loadedShaders)) {
        // // This crashes
        // shader.resources.uniforms.uniforms.uWorldStageTransform = t;

        // This works
        shader.resources.uniforms.uniforms.uTx = t.tx;
        shader.resources.uniforms.uniforms.uTy = t.ty;
    }
}

function loadShaderGeometry(
    s: string,
    texture: Texture,
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
                createInstancedTexturedQuadGeometry(texture, instanceCount);
            loadedGeometry[texture.uid] = {
                geometry,
                instanceCount,
                instancePositions,
                mesh: new Mesh<Geometry, Shader>({
                    geometry,
                    shader: loadedShaders[s]!,
                }),
            };
        } else {
            loadedGeometry[texture.uid] = {
                geometry: createTexturedQuadGeometry(texture),
            };
        }
    }

    return [loadedShaders[s], loadedGeometry[texture.uid]];
}

function createShader(s: string, texture: Texture): Shader {
    const { height, width } = texture.frame;
    return Shader.from({
        gl: shaders[s],
        resources: {
            uTexture: texture.source,
            uniforms: {
                // uWorldStageTransform: {
                //     value: new Matrix(),
                //     type: "mat3<f32>",
                // },
                uTx: {
                    value: 0,
                    type: "f32",
                },
                uTy: {
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

function createTexturedQuadGeometry(texture: Texture): Geometry {
    const { width, height } = texture.frame;
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
): [Geometry, Buffer] {
    const { width, height } = texture.frame;
    const { x0, y0, x1, y1, x2, y2, x3, y3 } = texture.uvs;

    if (instanceCount < 1) {
        throw new Error("Instance count must be greater than 0");
    }

    const instancePositions = new Buffer({
        data: new Float32Array(instanceCount * 2), // x, y
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
                },
            },
            indexBuffer: [0, 1, 2, 2, 3, 0], // quad
            instanceCount,
        }),
        instancePositions,
    ];
}

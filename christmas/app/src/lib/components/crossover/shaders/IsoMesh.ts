import { Geometry, Mesh, Shader, Texture } from "pixi.js";
import { loadShaderGeometry, type OptionalShaderTextures } from ".";
import type { Light } from "./ambient";

export { IsoMesh };

class IsoMesh extends Mesh<Geometry, Shader> {
    public depthStart: number = 0;
    public depthScale: number = 0;
    public depthLayer: number = 0;
    public cellHeight: number = 1;
    public normal: Texture | undefined = undefined;

    constructor({
        shaderName,
        texture,
        normal,
        depthStart,
        depthScale,
        depthLayer,
        cellHeight,
        geometryUid,
        textures,
    }: {
        shaderName: string;
        texture: Texture;
        normal?: Texture;
        depthStart: number;
        depthScale: number;
        depthLayer: number;
        geometryUid: string;
        cellHeight?: number;
        textures?: OptionalShaderTextures; // set any other textures here
    }) {
        const { shader, geometry, shaderGeometryUid } = loadShaderGeometry(
            {
                shaderName,
                texture,
                normal,
                width: texture.width,
                height: texture.height,
                depthScale,
                depthStart,
                geometryUid,
            },
            {
                cellHeight: cellHeight ?? 1,
                textures,
            },
        );

        super({
            shader,
            geometry,
            texture,
        });

        this.normal = normal;
        this.depthStart = depthStart;
        this.depthScale = depthScale;
        this.depthLayer = depthLayer;
        this.cellHeight = cellHeight ?? 1;
        this.cullable = true;
    }

    updateLight(light: Light) {
        if (this.normal && this.shader) {
            this.shader.resources.uniforms.uniforms.uLight = new Float32Array([
                light.x,
                light.y,
                light.intensity,
            ]);
        }
    }

    updateDepth(depth: number): void {
        // Update zIndex
        this.zIndex = this.depthLayer + depth * this.depthScale;

        // This updates the depth of the instance in the shader
        const ip = this.geometry.getBuffer("aInstancePosition");
        ip.data.set([0, depth, 0]);
        ip.update();
    }
}

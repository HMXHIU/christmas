import { Geometry, Mesh, Shader, Texture } from "pixi.js";
import { loadShaderGeometry, type OptionalShaderTextures } from ".";

export { IsoMesh };

class IsoMesh extends Mesh<Geometry, Shader> {
    public zOffset: number = 0;
    public zScale: number = 0;
    public renderLayer: number = 0;
    public cellHeight: number = 1;

    constructor({
        shaderName,
        texture,
        zOffset,
        zScale,
        renderLayer,
        cellHeight,
        uid,
        textures,
    }: {
        shaderName: string;
        texture: Texture;
        zOffset?: number;
        zScale?: number;
        renderLayer?: number;
        cellHeight?: number;
        uid?: string;
        textures?: OptionalShaderTextures; // set any other textures here
    }) {
        const { shader, geometry } = loadShaderGeometry(
            shaderName,
            texture,
            texture.width,
            texture.height,
            {
                zOffset: zOffset || 0,
                zScale: zScale || 0,
                cellHeight: cellHeight || 1,
                uid,
                textures,
            },
        );

        super({
            shader,
            geometry,
            texture,
        });

        this.zOffset = zOffset ?? 0;
        this.zScale = zScale ?? 0;
        this.renderLayer = renderLayer ?? 0;
        this.cellHeight = cellHeight ?? 1;
        this.cullable = true;
    }

    updateDepth(isoY: number): void {
        // Update zIndex
        this.zIndex = this.renderLayer * isoY;

        // This updates the depth of the instance in the shader (only isoY is used)
        const ip = this.geometry.getBuffer("aInstancePosition");
        ip.data.set([0, isoY, 0]);
        ip.update();
    }
}

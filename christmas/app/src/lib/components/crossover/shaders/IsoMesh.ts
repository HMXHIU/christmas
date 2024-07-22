import { Geometry, Mesh, Shader, Texture } from "pixi.js";
import { loadShaderGeometry } from ".";

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
    }: {
        shaderName: string;
        texture: Texture;
        zOffset?: number;
        zScale?: number;
        renderLayer?: number;
        cellHeight?: number;
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

    updateDepth(
        isoX: number,
        isoY: number,
        elevation: number,
        z?: number,
    ): void {
        // This updates the depth of the instance in the shader
        const ip = this.geometry.getBuffer("aInstancePosition");
        ip.data.set([isoX, isoY, elevation]);
        ip.update();

        // Update zIndex
        this.zIndex = this.renderLayer * isoY + (z ?? 0);
    }
}

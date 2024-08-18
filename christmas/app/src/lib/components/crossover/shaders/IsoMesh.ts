import { Container, Geometry, Graphics, Mesh, Shader, Texture } from "pixi.js";
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
                zOffset: zOffset ?? 0,
                zScale: zScale ?? 0,
                cellHeight: cellHeight ?? 1,
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

        if (this.renderLayer < 1) {
            console.warn("renderLayer should not be 0");
        }
        if (this.zScale >= 0) {
            console.warn("zScale should be a negative fraction");
        }
    }

    updateDepth(isoY: number): void {
        // Update zIndex
        this.zIndex = this.renderLayer * isoY;

        // This updates the depth of the instance in the shader (only isoY is used)
        const ip = this.geometry.getBuffer("aInstancePosition");
        ip.data.set([0, isoY, 0]);
        ip.update();
    }

    debugBounds(): Container {
        // Add this to the parent of this IsoMesh to debug
        const debugContainer = new Container();
        const { x, y, width, height } = this.getBounds();
        // Draw bounding box
        debugContainer.addChild(
            new Graphics()
                .rect(x, y, width, height)
                .stroke({ color: 0xff0000 }),
        );
        // Draw origin
        debugContainer.addChild(
            new Graphics().circle(this.x, this.y, 2).fill({ color: 0xff0000 }),
        );
        return debugContainer;
    }
}

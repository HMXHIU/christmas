import { Container, Texture } from "pixi.js";
import { IsoMesh } from "../../shaders/IsoMesh";
import { layers } from "../layers";
import { CELL_WIDTH } from "../settings";
import { cartToIso } from "../utils";

export { WorldEntityContainer };

class WorldEntityContainer extends Container {
    public mesh: IsoMesh | null = null;
    public texture: Texture | null = null;

    public textureOffset: { x: number; y: number } = { x: 0, y: 0 };
    public layerOffset: { x: number; y: number } = { x: 0, y: 0 };
    public tileOffset: { x: number; y: number } = { x: 0, y: 0 };

    public depthStart: number = 0;
    public depthScale: number = 0;
    public depthLayer: number = 0;

    constructor({
        texture,
        layer,
        cellHeight,
        imageWidth,
        imageHeight,
        tileWidth,
        tileHeight,
        textureOffset,
        layerOffset,
        tileOffset,
        tileId,
    }: {
        texture: Texture;
        layer: string;
        imageWidth: number;
        imageHeight: number;
        tileWidth: number;
        tileHeight: number;
        textureOffset: { x: number; y: number };
        layerOffset: { x: number; y: number };
        tileOffset: { x: number; y: number };
        tileId: string;
        cellHeight?: number;
    }) {
        super();

        this.textureOffset = textureOffset;
        this.layerOffset = layerOffset;
        this.tileOffset = tileOffset;

        if (this.mesh == null) {
            this.texture = texture;

            const { depthLayer, depthScale, depthStart } =
                layers.depthPartition(layer ?? "entity");
            this.depthLayer = depthLayer;
            this.depthScale = depthScale;
            this.depthStart = depthStart;

            this.mesh = new IsoMesh({
                shaderName: "entity",
                texture,
                cellHeight: cellHeight ?? 1,
                depthLayer,
                depthScale,
                depthStart,
                geometryUid: tileId,
            });
            this.mesh.eventMode = "none"; // Prevents inheritance of parent eventMode

            // Set scale (should be the same for both x and y)
            const xCells = imageWidth / tileWidth;
            const yCells = imageHeight / tileHeight;
            const screenWidth = xCells * CELL_WIDTH;
            const scale = screenWidth / imageWidth;
            this.mesh.scale.set(scale, scale);

            /* 
            By default the tiled editor uses the bottom-left of an image as the anchor
            In pixi.js the pivot is based on the original size of the texture without scaling
            */
            const anchor = { x: 0, y: 1 };
            const pivotX = anchor.x * imageWidth;
            const pivotY = anchor.y * imageHeight;
            this.mesh.pivot.set(
                pivotX - this.tileOffset.x,
                pivotY - this.tileOffset.y,
            );

            this.addChild(this.mesh);
        }
    }

    setIsoPosition({
        row,
        col,
        elevation,
    }: {
        row: number;
        col: number;
        elevation: number;
    }) {
        if (!this.mesh) return;

        const [layerIsoX, layerIsoY] = cartToIso(
            col * CELL_WIDTH,
            row * CELL_WIDTH,
        );

        const isoX =
            layerIsoX +
            (this.layerOffset.x + this.textureOffset.x) * this.mesh.scale.x;
        const isoY =
            layerIsoY +
            (this.layerOffset.y + this.textureOffset.y) * this.mesh.scale.y;

        this.x = isoX;
        this.y = isoY - elevation;

        this.updateDepth(isoY);
    }

    updateDepth(depth: number) {
        this.zIndex = this.depthLayer + depth * this.depthScale;

        if (this.mesh) {
            this.mesh.updateDepth(depth);
        }
    }
}

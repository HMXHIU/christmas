import { geohashToGridCell } from "$lib/crossover/utils";
import { cartToIso, CELL_WIDTH } from "./utils";

export { Layers, layers };

class Layers {
    public layers: string[] = [];
    // worldHeight is used as the conversion factor to convert isoY to depth
    public worldHeight: number = 0;

    constructor({
        layers,
        worldHeight,
    }: {
        layers: string[];
        worldHeight: number;
    }) {
        this.layers = layers;
        this.worldHeight = worldHeight;
    }

    public depthLayer(layer: string): number {
        // Partition the depth space into different layers so that each layer will not have any overlapping objects
        return this.layers.indexOf(layer);
    }

    public depthPartition(layer: string): {
        depthStart: number;
        depthScale: number;
        depthLayer: number;
    } {
        let depthLayer = this.depthLayer(layer);
        if (depthLayer < 0) {
            depthLayer = 0;
            console.warn(`Missing layer ${layer}, default to 0`);
        }
        // Depth size is the depth range allocated to the layer
        const depthSize = 1 / this.layers.length; // from 1 to 0 (0 to -1 is reserved for sprite/graphics)
        const depthStart = 1 - depthLayer * depthSize;

        return {
            depthLayer,
            depthStart,
            // Depth scale is used to convert the isoY coordinate to a depth within (depthStart to depthStart + depthSize)
            depthScale: depthSize / this.worldHeight, // scale
        };
    }
}

const { row: bottomRightRow, col: bottomRightCol } =
    geohashToGridCell("pbzupuzv");
const maxIsoY = cartToIso(
    bottomRightCol * CELL_WIDTH,
    bottomRightRow * CELL_WIDTH,
)[1]; // 33093136

const layers = new Layers({
    layers: ["biome", "floor", "entity"],
    worldHeight: maxIsoY / 1000, // ~33k cells (this means we need to recalculate the `worldOffset` every time the player moves past 33k cells)
});

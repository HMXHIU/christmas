import { cartToIso, geohashToGridCell } from "$lib/crossover/utils";
import { CELL_WIDTH } from "./utils";

export { Layers, layers };

class Layers {
    public layers: string[] = [];
    public worldGridHeight: number = 0;

    constructor({
        layers,
        worldGridHeight,
    }: {
        layers: string[];
        worldGridHeight: number;
    }) {
        this.layers = layers;
        this.worldGridHeight = worldGridHeight;
    }

    public depthLayer(layer: string): number {
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
        const depthSize = 1 / this.layers.length; // from 1 to 0 (0 to -1 is reserved for sprite/graphics)
        const depthStart = 1 - depthLayer * depthSize;

        return {
            depthLayer,
            depthStart,
            depthScale: depthSize / this.worldGridHeight, // scale
        };
    }
}

const { row: bottomRightRow, col: bottomRightCol } =
    geohashToGridCell("pbzupuzv");
const worldIsoHeight = cartToIso(
    bottomRightCol * CELL_WIDTH,
    bottomRightRow * CELL_WIDTH,
)[1];

const layers = new Layers({
    layers: ["biome", "floor", "entity"],
    worldGridHeight: worldIsoHeight,
});

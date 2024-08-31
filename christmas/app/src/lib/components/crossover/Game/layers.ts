import { WORLD_ISOY_MAX } from "./utils";

export { Layers, layers };

class Layers {
    public layers: string[] = [];
    // worldHeight is used as the conversion factor to convert isoY to depth
    public worldHeight: number = 0;
    public depthSize: number = 1;
    public depthScale: number = 1;

    constructor({ layers }: { layers: string[] }) {
        this.layers = layers;
        // ~33k cells (this means we need to recalculate the `worldOffset` every time the player moves past 33k cells)
        this.worldHeight = WORLD_ISOY_MAX / 1000;
        // Depth size is the depth range allocated to the layer ([1, 0] usable range, [0, -1] reserved for sprites)
        this.depthSize = 1 / this.layers.length;
        // Depth scale is used to convert the isoY coordinate to a depth within (depthStart to depthStart + depthSize)
        this.depthScale = this.depthSize / this.worldHeight;
    }

    public depthLayer(layer: string): number {
        // Partition the depth space into different layers so that each layer will not have any overlapping objects
        return this.layers.indexOf(layer);
    }

    public depthPartition(layer: string): {
        depthStart: number;
        depthScale: number;
        depthLayer: number;
        depthSize: number;
    } {
        let depthLayer = this.depthLayer(layer);
        if (depthLayer < 0) {
            depthLayer = 0;
            console.warn(`Missing layer ${layer}, default to 0`);
        }

        /*  
            Note: 
            - `isoY` can be negative after `worldOffset`
            - `isoY` ranges from [-worldHeight/2, +worldHeight/2]
        */
        const depthStart =
            1 -
            depthLayer * this.depthSize -
            (this.worldHeight / 2) * this.depthScale;

        return {
            depthLayer,
            depthStart,
            depthScale: this.depthScale,
            depthSize: this.depthSize,
        };
    }
}

const layers = new Layers({
    layers: ["biome", "floor", "entity"],
});

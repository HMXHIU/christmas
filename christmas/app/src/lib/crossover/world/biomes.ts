import { type AssetMetadata } from ".";
export { type Biome };

interface Biome {
    biome: string;
    name: string;
    description: string;
    traversableSpeed: number; // 0.0 - 1.0
    asset?: AssetMetadata;
}

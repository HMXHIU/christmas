import { Assets } from "pixi.js";
import { IsoMesh } from "../../shaders/IsoMesh";
import { layers } from "../layers";

export { createBlobShadow };

async function createBlobShadow(): Promise<IsoMesh> {
    const texture = (await Assets.loadBundle("effects")).effects.textures[
        "blob-shadow"
    ];

    const { depthLayer, depthScale, depthStart } =
        layers.depthPartition("shadow");

    // Create the IsoMesh
    const isoMesh = new IsoMesh({
        shaderName: "entity",
        texture,
        depthLayer,
        depthScale,
        depthStart,
        geometryUid: "blob-shadow", // doesn't matter for action bubble to share the same geometry (1D on floor layer)
    });

    isoMesh.pivot = {
        x: texture.defaultAnchor.x * texture.width,
        y: texture.defaultAnchor.y * texture.height,
    };

    // Make isometric
    isoMesh.scale.y = 0.5;
    isoMesh.scale.x *= 1.8;
    isoMesh.scale.y *= 1.8;

    return isoMesh;
}

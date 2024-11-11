import { Assets, Texture } from "pixi.js";
import { IsoMesh } from "../../shaders/IsoMesh";
import { layers } from "../layers";

export { createBlobShadow, createProjectedShadow };

async function createBlobShadow(): Promise<IsoMesh> {
    const texture: Texture = (await Assets.loadBundle("effects")).effects
        .textures["blob-shadow"];
    const { depthLayer, depthScale, depthStart } =
        layers.depthPartition("shadow");
    const anchor = texture.defaultAnchor ?? { x: 0.5, y: 0.5 };

    // Create the IsoMesh
    const isoMesh = new IsoMesh({
        shaderName: "entity",
        texture,
        depthLayer,
        depthScale,
        depthStart,
        geometryUid: "blob-shadow", // doesn't matter for action bubble to share the same geometry (1D on shadow layer)
    });

    isoMesh.pivot = {
        x: anchor.x * texture.width,
        y: anchor.y * texture.height,
    };

    // Make shadow more translucent (TODO: depend on time of day)
    if (isoMesh.shader) {
        isoMesh.shader.resources.uniforms.uniforms.uAlpha = 0.75;
    }

    // Make isometric
    isoMesh.scale.y = 0.5;
    isoMesh.scale.x *= 1.8;
    isoMesh.scale.y *= 1.8;

    return isoMesh;
}

async function createProjectedShadow(isoMesh: IsoMesh): Promise<IsoMesh> {
    const { depthLayer, depthScale, depthStart } =
        layers.depthPartition("shadow");
    const anchor = isoMesh.texture.defaultAnchor ?? { x: 0.5, y: 0.5 };

    const shadowMesh = new IsoMesh({
        shaderName: "entity",
        texture: isoMesh.texture,
        depthLayer,
        depthScale,
        depthStart,
        geometryUid: "proj-shadow", // doesn't matter for action bubble to share the same geometry (1D on floor layer)
    });

    shadowMesh.pivot = {
        x: anchor.x * isoMesh.texture.width,
        y: anchor.y * isoMesh.texture.height,
    };
    shadowMesh.scale = isoMesh.scale;
    shadowMesh.position = isoMesh.position;

    // Shear and translate to create shadow

    // Overwrite texture colour to all shadow colour
    shadowMesh.skew.set(1, 0);

    return shadowMesh;
}

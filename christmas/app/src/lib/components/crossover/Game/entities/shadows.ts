import { Assets, Texture } from "pixi.js";
import { IsoMesh } from "../../shaders/IsoMesh";
import { masks } from "../../shaders/materials";
import { layers } from "../layers";

export { createBlobShadow, createProjectedShadow };

async function createBlobShadow(): Promise<IsoMesh> {
    const texture: Texture = (await Assets.loadBundle("effects")).effects
        .textures["blob-shadow"];
    const anchor = texture.defaultAnchor ?? { x: 0.5, y: 0.5 };

    // Create the IsoMesh
    const isoMesh = new IsoMesh({
        shaderName: "entity",
        texture,
        geometryUid: "blob-shadow", // doesn't matter for action bubble to share the same geometry (1D on shadow layer)
        ...layers.depthPartition("shadow"),
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
    const shadowMesh = new IsoMesh({
        shaderName: "entity",
        texture: isoMesh.texture,
        cellHeight: isoMesh.cellHeight,
        geometryUid: "proj-shadow", // doesn't matter for action bubble to share the same geometry (1D on floor layer)
        ...layers.depthPartition("shadow"),
    });
    const anchor = isoMesh.texture.defaultAnchor ?? { x: 0.5, y: 0.5 };

    // Mask the texture
    if (shadowMesh.shader) {
        shadowMesh.shader.resources.uniforms.uniforms.uTint = masks.shadow;
        shadowMesh.shader.resources.uniforms.uniforms.uMask = 1.0;
    }

    /*
    When skewing, we need to skew about the pivot, however the pivot is set on the EC, not the mesh,
    Thus we have to set the pivot, skew, translate to acheive the same effect
    Use a shadow skew between 60 and 45 degrees (60 aligns too nearly to the isometric axis and looks artificial)
    */
    shadowMesh.scale = isoMesh.scale;
    shadowMesh.position = isoMesh.position;
    shadowMesh.pivot = {
        x: anchor.x * isoMesh.texture.width,
        y: anchor.y * isoMesh.texture.height,
    };
    shadowMesh.scale.y *= 0.7; // shorter shadows
    shadowMesh.skew.x = Math.PI / 3.5;
    shadowMesh.position.x += shadowMesh.pivot.x;
    shadowMesh.position.y += shadowMesh.pivot.y;

    return shadowMesh;
}

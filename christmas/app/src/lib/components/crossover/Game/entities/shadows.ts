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
        geometryUid: "blob-shadow", // all blob shadows can be shared (same texture)
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

const FULL_SKEW = Math.PI / 3.5;

async function createProjectedShadow(
    isoMesh: IsoMesh,
): Promise<IsoMesh | null> {
    const shadowMesh = new IsoMesh({
        shaderName: "entity",
        texture: isoMesh.texture,
        cellHeight: isoMesh.cellHeight,
        geometryUid: `${isoMesh.texture.uid}-shadow`,
        ...layers.depthPartition("shadow"),
    });
    const anchor = isoMesh.texture.defaultAnchor ?? { x: 0.5, y: 0.5 };

    // Skip projected shadows if the anchor is very close to the center (flat, very close to ground)
    if (anchor.y > 0.4 && anchor.y < 0.6) {
        return null;
    }

    // Mask the texture
    if (shadowMesh.shader) {
        shadowMesh.shader.resources.uniforms.uniforms.uTint = masks.shadow;
        shadowMesh.shader.resources.uniforms.uniforms.uMask = 1.0;
    }

    /*
    When skewing, we need to skew about the pivot, however the pivot is set on the EC, not the mesh,
    Thus we have to set the pivot, skew, translate to acheive the same effect
    Use a shadow skew between 60 and 45 degrees (60 aligns too nearly to the isometric axis and looks artificial)
    For textures where the anchor.y is closer to 0.5 than 1 (indicates flat on the ground) we should not skew too much
    */
    shadowMesh.scale = isoMesh.scale;
    shadowMesh.position = isoMesh.position;
    shadowMesh.pivot = {
        x: anchor.x * isoMesh.texture.width,
        y: anchor.y * isoMesh.texture.height,
    };
    shadowMesh.scale.y *= 0.7; // shorter shadows
    const skewAmount = Math.max(anchor.y - 0.5, 0) * 2; // full skew when anchor.y = 1
    shadowMesh.skew.x = skewAmount * FULL_SKEW;
    shadowMesh.position.x += shadowMesh.pivot.x;
    shadowMesh.position.y += shadowMesh.pivot.y;

    return shadowMesh;
}

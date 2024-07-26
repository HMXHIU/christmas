## Character animation framework

I am creating a character sprite animation framework for a 2d isometric game in PIXI.js v8. The framework uses bones instead of a sprite sheet.

These are following bones and the textures:

- frontLowerArmBone, front_lower_arm.png
- frontUpperArmBone, front_upper_arm.png
- torsoBone (Parent), torso.png
- headBone, head.png
- backLowerArmBone, back_lower_arm.png
- backUpperArmBone, back_upper_arm.png
- frontLowerLegBone, front_lower_leg.png
- frontUpperLegBone, front_upper_leg.png
- backLowerLegBone, back_lower_leg.png
- backUpperLegBone,back_upper_leg.png

Each bone will be attached a texture. There should be an avatar metadata file in json that defines the bones and the textures that are attached to each bone. The point of attachment of each texture to the bone is the texture's anchor point (in pixijs). As the bones are scaled in length, it should also scale the texture attached to it. The length and width of the bone should be defined in the metadata file (defaults to sane sizes).

The avatar should not use PIXI.js Sprites, but rather `Mesh<Geometry, Shader>`, this is because I have a custom shader which specifies the z coordinate, as depth testing is enabled for webgl. The geometry is a quad and the textures have alpha enabled. The shader will be provided to you.

There is only 2 views for the character, southwest and southeast. The textures provided is for the southwest view. The southeast view can be mirrored from the southwest view. The framework should mirror the textures to create the southeast view.

The bones will be animated using a tweening library (GASP). The bones will be animated in a way for such animations:

- idle, walk, run, attack

There should be an animation metadata file in json that defines the animations and the bones that are involved in each animation.

This is a summary of of the bones and textures required:

- frontLowerArmBone, front_lower_arm.png
- frontUpperArmBone, front_upper_arm.png
- torsoBone, torso.png
- headBone, head.png
- backLowerArmBone, back_lower_arm.png
- backUpperArmBone, back_upper_arm.png
- frontLowerLegBone, front_lower_leg.png
- frontUpperLegBone, front_upper_leg.png
- backLowerLegBone, back_lower_leg.png
- backUpperLegBone,back_upper_leg.png

Each bone should have a position relative to the parent bone. The parent bone is the torso bone. The anchor points of each texture is the base of each bone.

Use the original texture size for the meshes. When then bones are attached, they are attached to the original texture dimensions and any scaling should scale the texture as well.

## Bone Length and Positioning Design Document

### Overview

To ensure accurate attachment and animation of bones in a skeleton, each bone must have a specified length and rotation. This length is critical as it determines the position of child bones, which need to attach to the ends of their respective parent bones (MIGHT NOT BE). The bone rotation is used to align the bone with the textures. The initial position, rotation and length of each bone are defined in the avatar JSON file, relative to the texture. During the rigging process, these bone attributes are set in relation to the texture. The base of the bone should be the anchor and the origin of the bone position. Subsequently, when constructing the skeleton, bones are transformed into their correct positions within the skeleton, and the textures rotate accordingly with the bones.

Updated:

- The bone positions in the avatar metadata JSON is relative to the anchor bone (without parent)
- The anchor bone is usually set at (0, 0), and is usually the torso bone
- When setting up the bone hierarchy, the child bone position must be calculated relative to theparent bone before adding to the parent bone
- The positions, rotations in the animation metadata JSON for each bone is relative to it's parent bone

### Detailed Requirements

1. **Bone Length Specification**:

   - Each bone must have a defined length.
   - This length determines where child bones attach to their parent bones.

2. **Bone Position and Length in Avatar JSON**:

   - If the texture anchor is at (0, 0) then a bone position of (0, 0) means that the base of the bone is at the anchor of the texture. The bone position is relative to the texture.
   - The initial position and length of each bone are defined in the avatar JSON file.
   - These values are relative to the texture and are crucial for proper rigging.

3. **Rigging Process**:

   - During the rigging process, the bone positions and lengths are set according to the data in the avatar JSON file.
   - This ensures that the bones align correctly with the texture.

4. **Skeleton Formation**:
   - Once the bones are rigged to the texture, they are transformed into their proper positions within the skeleton.
   - Textures should rotate along with the bones to maintain the correct orientation and alignment.

### Implementation Steps

1. **Define Bone Lengths**:

   - Ensure each bone in the JSON file has a length attribute.
   - Validate that the length values correctly represent the distance from the bone’s start to its end.

2. **Set Bone Positions and Lengths Relative to Texture**:

   - During the rigging process, read the bone position and length from the avatar JSON.
   - Adjust the bone attributes to align with the texture accordingly.

3. **Transform Bones for Skeleton Construction**:

   - After rigging, calculate the transformations needed to place the bones in their correct positions within the skeleton.
   - Apply these transformations to the bones.

4. **Rotate Textures with Bones**:
   - Ensure that textures rotate in sync with the bones to maintain visual consistency.
   - Implement rotation logic that binds the texture’s orientation to the bone’s rotation.

By following these steps, the bone structure will be accurately represented, allowing for correct animation and visual alignment within the skeleton.

## Editor/Animation Preview Tool

In addition to creating the framework, I would like an editor tool that allows me to preview the animations. The editor tool should allow me to:

- Load the avatar metadata file
- Preview the textures from the avatar metadata file
- Load the animation metadata file
- Preview the bone animations from the animation metadata file
- View/Load the textures attached to each bone
- Scale the bones
- Attach the bone to the texture via the ui
- Play/Pause the animations
- Select the animation to preview

The editor tool should be a web application that uses PIXI.js v8 and served on localhost. The editor tool should be able to load the avatar metadata file and the animation metadata file and display the avatar with the selected animation.

## Other requirements

Keep the animation framework a separate module from the editor tool so that I can use the framework in my game. The editor tool should be able to load the framework as a module.

## Editor Bone Texture Rigging Tool

Updated:

- This rigging tool only sets the textureAnchor, rotation, length of the individual bones
- The bone positions in the avatar metadata JSON is relative to the anchor bone and must be set in the main editor tool where the bone hierarchy is set up.

I would like an editor tool that allows me to rig the bones to the textures. The tool should allow me to accomplish the following tasks:

- Load the avatar metadata file
- Attach the bones to the textures
- View the textures attached to each bone
- Position the bones relative to the textures
- Save the avatar metadata file with the bone positions relative to the textures

The UI should have the following:

- A select list showing the bones
- A select list showing the textures
- When a bone is selected, the user should select a texture from the select list to attach to the bone
- A canvas to the right of the bones and textures list to position/rig the bones relative to the textures
- When a bone and its texture are selected, both should be drawn on the canvas on the right
- The default bone position should be at the center of the texture
- The canvas should allow dragging of the bones to position them relative to the texture

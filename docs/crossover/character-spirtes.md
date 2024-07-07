## Character animation framework

I am creating a character sprite animation framework for a 2d isometric game in PIXI.js v8. The framework uses bones instead of a sprite sheet.

These are following bones:

- Head, Torso (Parent Bone), Left Arm, Right Arm, Left Leg, Right Leg

Each bone will be attached a texture. There should be an avatar metadata file in json that defines the bones and the textures that are attached to each bone. The point of attachment of each texture to the bone is the texture's anchor point (in pixijs). As the bones are scaled in length, it should also scale the texture attached to it. The length and width of the bone should be defined in the metadata file (defaults to sane sizes).

The avatar should not use PIXI.js Sprites, but rather `Mesh<Geometry, Shader>`, this is because I have a custom shader which specifies the z coordinate, as depth testing is enabled for webgl. The geometry is a quad and the textures have alpha enabled. The shader will be provided to you.

Because this is an isometric game, there are 2 directional views of the avatar, northeast and southwest. The other views, southeast and northwest, can be mirrored from these two views. Each texture would have 2 views, northeast and southwest, the framework should mirror the textures for southeast and northwest views.

The bones will be animated using a tweening library (GASP). The bones will be animated in a way for such animations:

- idle, walk, run, attack

There should be an animation metadata file in json that defines the animations and the bones that are involved in each animation.

This is a summary of of the bones and textures required:

- headBone, headTextureNE, headTextureSW
- torsoBone, torsoTextureNE, torsoTextureSW
- leftUpperArmBone, leftUpperArmTextureNE, leftUpperArmTextureSW
- rightUpperArmBone, rightUpperArmTextureNE, rightUpperArmTextureSW
- leftLowerArmBone, leftLowerArmTextureNE, leftLowerArmTextureSW
- rightLowerArmBone, rightLowerArmTextureNE, rightLowerArmTextureSW
- leftLowerLegBone, leftLowerLegTextureNE, leftLowerLegTextureSW
- rightLowerLegBone rightLowerLegTextureNE, rightLowerLegTextureSW
- leftUpperLegBone, leftUpperLegTextureNE, leftUpperLegTextureSW
- rightUpperLegBone rightUpperLegTextureNE, rightUpperLegTextureSW
- leftFootBone, leftFootTextureNE, leftFootTextureSW
- rightFootBone, rightFootTextureNE, rightFootTextureSW

Each bone should have a position relative to the parent bone. The parent bone is the torso bone. The anchor points of each texture is the base of each bone.

## Editor/Animation Preview Tool

In addition to creating the framework, I would like an editor tool that allows me to preview the animations. The editor tool should allow me to:

- Load the avatar metadata file
- Preview the textures from the avatar metadata file
- Load the animation metadata file
- Preview the bone animations from the animation metadata file
- View/Load the textures attached to each bone
- Scale the bones
- Play/Pause the animations
- Select the animation to preview

The editor tool should be a web application that uses PIXI.js v8 and served on localhost. The editor tool should be able to load the avatar metadata file and the animation metadata file and display the avatar with the selected animation.

## Other requirements

Keep the animation framework a separate module from the editor tool so that I can use the framework in my game. The editor tool should be able to load the framework as a module.

# Layer system for meshes

Problem:

- Webgl depth testing is enabled and the z coordinate (isoY + offset) is used to set the depth.
- When there are 2 objects on the same position (same isoY), the offset is increase the z coordinate, for instance the floor layer has an offset greater than the biome offset and the player entity has a higher offset than the floor.
- The issue is that changing the z coodinate is the wrong way, for instance a biome in front of the player might become behind him after adding an offset.

Solution:

- Remove the zOffset from changing the z coordinate.
- A layer is defined as a collection of objects in which all of them are in front of the layer below and in behind of all the objects of the layer above.
- The `depthSize` is from 1 (fartest) to 0 (0 to -1 is reserved for sprites/graphics)
- Allocate the `depthSize` equally to a `depthSpace` for each layer
- The `depthScale` for each layer is the `depthSpace` divided by the `maxWorldHeight`
- This an entity's depth in floor is guaranteed to be greated than biome and less than entity

```
Layer    zIndex        depth
------------------------------------
biome     0             1



------------------------------------
floor     1             0.5



------------------------------------
entity    2             0



------------------------------------
```

#### Allow nested layers

For instance, at the top level, the layers are

```ts
const layers = ["biome", "grass", "floor", "entity"];
```

However, the entity might itself have children and its own layers, when rendering the entity it should also rendering it in order

```ts
const avatar_layers = [
  "backHairBone",
  "backUpperArmBone",
  "backLowerArmBone",
  "backUpperLegBone",
  "backLowerLegBone",
  "torsoBone",
  "headBone",
  "frontUpperLegBone",
  "frontLowerLegBone",
  "frontUpperArmBone",
  "frontLowerArmBone",
  "frontHairBone",
];
```

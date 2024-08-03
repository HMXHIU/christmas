# Face Mesh

## Problem

The avatar head is made up of different textures:

1. backHair
2. face (a bald head texture)
3. eyes
4. frontHair

- Use the existing bone and poses, each component is 1 bone eg. (backHairBone, eyeBone, etc..), this allows the proper placement and order of the textures (eg. back hair should be behind torso, but front hair should be in front)
- The texture normals should also be included with the proper naming, the folder structure is as follows

```
avatar
    /eyes
        /female_sad
            eyes.png
    /face
        /female_default
            face.png
            face_normal.png
    /hair
        /female_long
            front_hair_normal.png
            back_hair_normal.png
        /female_wavy
            front_hair.png
            back_hair.png
            front_hair_normal.png
            back_hair_normal.png
```

- Any normal maps are postfixed with `_normal`, they should be applied if present.

#### Face shader

- Use existing entity shader in `components/crossover/shaders/singular/entity`
- Add `uNormalTexture` to `ShaderGeometry`

#### Avatar metadata

- Add an additional `normal` field to reference the normal texture

```json
// humanoid.json
{
  "headBone": {
    "bone": "headBone",
    "height": 61.53906249999999,
    "width": 20,
    "parent": "torsoBone",
    "textures": {
      "face": {
        "anchor": {
          "x": 0.5346436201364002,
          "y": 0.6693581090375511
        },
        "rotation": -1.7693255686842788,
        "normal": "face_normal" // normal texture
      }
    }
  },
  "frontHairBone": {
    "bone": "frontHairBone",
    "height": 61.53906249999999,
    "width": 20,
    "parent": "headBone",
    "textures": {
      "front_hair": {
        "anchor": {
          "x": 0.5346436201364002,
          "y": 0.6693581090375511
        },
        "rotation": -1.7693255686842788,
        "normal": "front_hair_normal" // normal texture
      }
    }
  },
  "backHairBone": {
    "bone": "backHairBone",
    "height": 61.53906249999999,
    "width": 20,
    "parent": "headBone",
    "textures": {
      "back_hair": {
        "anchor": {
          "x": 0.5346436201364002,
          "y": 0.6693581090375511
        },
        "rotation": -1.7693255686842788,
        "normal": "back_hair_normal" // normal texture
      }
    }
  },
  "textures": {
    "face": "http://localhost:5173/avatar/images/head/face/female_default/face.png",
    "front_hair": "http://localhost:5173/avatar/images/head/hair/female_long/front_hair.png",
    "front_hair_normal": "http://localhost:5173/avatar/images/head/hair/female_long/front_hair_normal.png",
    "back_hair": "http://localhost:5173/avatar/images/head/hair/female_long/back_hair.png",
    "back_hair_normal": "http://localhost:5173/avatar/images/head/hair/female_long/back_hair_normal.png"
  }
}
```

```json
// humanoid_animation.json
{
  "poses": [
    {
      "bone": "backHairBone",
      "texture": "back_hair",
      "position": {
        "x": 136.69720264246504,
        "y": 0.43903521728231
      },
      "rotation": -0.20863477562918042,
      "scale": {
        "x": 1,
        "y": 1
      }
    },
    {
      "bone": "headBone",
      "texture": "head",
      "position": {
        "x": 136.69720264246504,
        "y": 0.43903521728231
      },
      "rotation": -0.20863477562918042,
      "scale": {
        "x": 1,
        "y": 1
      }
    },
    {
      "bone": "frontHairBone",
      "texture": "front_hair",
      "position": {
        "x": 136.69720264246504,
        "y": 0.43903521728231
      },
      "rotation": -0.20863477562918042,
      "scale": {
        "x": 1,
        "y": 1
      }
    }
  ]
}
```

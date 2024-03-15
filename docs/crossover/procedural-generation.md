# Procedural Generation of World

- split map into 32 (8 \* 4) squares, give it general attributes, let procedural generation generate new attributes and lower and lower grid levels

For example, start at the higest level `continent`

```javascript
seeds: {
    continent: {
        b: { bio: 0.5, hostile: 0.2, water: 0.1 },
        c: { bio: 0.5, hostile: 0.2, water: 0.1 },
        f: { bio: 0.5, hostile: 0.2, water: 0.1 },
        g: { bio: 0.5, hostile: 0.2, water: 0.1 },
        u: { bio: 0.5, hostile: 0.2, water: 0.1 },
        v: { bio: 0.5, hostile: 0.2, water: 0.1 },
        y: { bio: 0.5, hostile: 0.2, water: 0.1 },
        z: { bio: 0.5, hostile: 0.2, water: 0.1 },
        "8": { bio: 0.5, hostile: 0.2, water: 0.1 },
        "9": { bio: 0.5, hostile: 0.2, water: 0.1 },
        d: { bio: 0.5, hostile: 0.2, water: 0.1 },
        e: { bio: 0.5, hostile: 0.2, water: 0.1 },
        s: { bio: 0.5, hostile: 0.2, water: 0.1 },
        t: { bio: 0.5, hostile: 0.2, water: 0.1 },
        w: { bio: 0.5, hostile: 0.2, water: 0.1 },
        x: { bio: 0.5, hostile: 0.2, water: 0.1 },
        "2": { bio: 0.5, hostile: 0.2, water: 0.1 },
        "3": { bio: 0.5, hostile: 0.2, water: 0.1 },
        "6": { bio: 0.5, hostile: 0.2, water: 0.1 },
        "7": { bio: 0.5, hostile: 0.2, water: 0.1 },
        k: { bio: 0.5, hostile: 0.2, water: 0.1 },
        m: { bio: 0.5, hostile: 0.2, water: 0.1 },
        q: { bio: 0.5, hostile: 0.2, water: 0.1 },
        r: { bio: 0.5, hostile: 0.2, water: 0.1 },
        "0": { bio: 0.5, hostile: 0.2, water: 0.1 },
        "1": { bio: 0.5, hostile: 0.2, water: 0.1 },
        "4": { bio: 0.5, hostile: 0.2, water: 0.1 },
        "5": { bio: 0.5, hostile: 0.2, water: 0.1 },
        h: { bio: 0.5, hostile: 0.2, water: 0.1 },
        j: { bio: 0.5, hostile: 0.2, water: 0.1 },
        n: { bio: 0.5, hostile: 0.2, water: 0.1 },
        p: { bio: 0.5, hostile: 0.2, water: 0.1 },
    },
},
```

Then generate more attributes for `territory` so and and so for until the lowest precision `building`

# Levels of precision and information at each level

Precision refers to the number of geohash characters

### Continent (1p)

Has 1 portal located at the highest ranked citadel

### Territory (2p)

neutral, hostile, player controled, governer, has 1 citadel, citadel is controlled by the higest ranked huild in the territory

### Guild/Tribe (3p)

has 1 guild house

### Weather (4p)

### City (4p)

### Town (5p)

cell: 4.89km \* 4.89km

### Building (8p)

cell: 38m \* 18m
Also the smallest unit of movement

## Generated Data

To get the description of a place, get the description at all levels and combine them to form a description

eg. "The weather is sunny, you are in hostile territory of xxx, the land is governed by xxx. you see a large in, etc ...."

### TODOs:

1. Manually generate `continent` data and attributes (scores for forest, plains - for PG for children)
2. Use PG to generate more noise at the `territory` level add territory level attributes (hostile, etc..)
3. Use PG to generate more noise at the `guild` level
4. Use PG to generate more noise at the `city` level -> the smallest unit of noise is 8 chars (trees, rocks, road, water bodies etc ...)

- Water becomes hostile territory for exploration
- Every continent has a portal of teleportation located in one of the citadels (the highest rank in that territory)
- Every territory has

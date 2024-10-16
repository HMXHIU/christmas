export { prefabDungeons, type Dungeon };

interface Dungeon {
    dungeon: string; // the geohash of the dungeon (as well as the dungeon id)
}

// These are manually defined dungeons in addition to the procedurally generated dungeons
const prefabDungeons: Record<string, Dungeon> = {
    jx1p7: {
        dungeon: "jx1p7", // Grande-Terre
    },
};

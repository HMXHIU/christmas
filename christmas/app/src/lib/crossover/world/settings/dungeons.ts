export { dungeons, type Dungeon };

interface Dungeon {
    dungeon: string;
    rooms: {
        room: string;
        entrances: string[];
    }[];
}

const dungeons: Dungeon[] = [
    {
        dungeon: "w21",
        rooms: [
            {
                room: "w21z9",
                entrances: ["w21z9edk"],
            },
        ],
    },
];

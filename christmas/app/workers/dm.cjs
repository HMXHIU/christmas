const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function respawnMonsters() {
    // Respawn monsters
    const { result } = await fetch(
        `${process.env.PUBLIC_HOST}/trpc/crossover.world.respawnMonsters`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.INTERNAL_SERVICE_KEY}`,
            },
        },
    ).then((res) => res.json());
    const { status, time } = result.data;
    console.log(
        `[${new Date().toISOString()}] Respawned monsters: ${status} (${time}ms)`,
    );
}

async function animateMonsters() {
    // Animate monsters
    const { result } = await fetch(
        `${process.env.PUBLIC_HOST}/trpc/crossover.world.animateMonsters`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.INTERNAL_SERVICE_KEY}`,
            },
        },
    ).then((res) => res.json());

    const { status, time } = result.data;
    console.log(
        `[${new Date().toISOString()}] Animated monsters: ${status} (${time}ms)`,
    );
}

async function run() {
    // Respawn monsters every 6 hours
    setInterval(respawnMonsters, 6 * 60 * 60 * 1000);

    // Animate monsters every 2 second
    setInterval(animateMonsters, 2000);

    while (true) {
        // Sleep for 1 minute
        await new Promise((r) => setTimeout(r, 60 * 1000));
        console.log(`[${new Date().toISOString()}] Dungeon Master is alive`);
    }
}

run();

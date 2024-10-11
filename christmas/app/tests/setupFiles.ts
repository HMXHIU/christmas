import { initServer } from "$lib/server";
import { beforeAll } from "vitest";

beforeAll(async () => {
    // The repositories are initially undefined in `server/index.ts`
    await initServer();
});

import { t } from ".";
import { communityRouter } from "../community/router";
import { crossoverRouter } from "../crossover/router";

// Routers
export const router = t.router({
    crossover: t.router(crossoverRouter),
    community: t.router(communityRouter),
});

export type Router = typeof router;

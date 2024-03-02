import { t } from ".";
import { crossoverRouter } from "../crossover/router";

// Routers
export const router = t.router({ crossover: t.router(crossoverRouter) });

export type Router = typeof router;

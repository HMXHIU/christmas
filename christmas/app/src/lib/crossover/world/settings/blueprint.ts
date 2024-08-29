import type { BluePrint, templates } from "../blueprint";

export { blueprints };

const blueprints: Record<templates, BluePrint> = {
    outpost: {
        template: "outpost",
        clusters: {
            market: {
                props: {
                    tavern: {
                        instances: { min: 1, max: 1 },
                    },
                },
                position: "random",
            },
        },
    },
    town: {
        template: "town",
        clusters: {
            market: {
                props: {
                    tavern: {
                        instances: { min: 1, max: 1 },
                    },
                },
                position: "random",
            },
        },
    },
};

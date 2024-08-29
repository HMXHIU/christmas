export { type BluePrint, type templates };

type templates = "outpost" | "town";

interface BluePrint {
    template: templates;
    clusters: {
        [cluster: string]: {
            props: {
                [prop: string]: {
                    instances: {
                        min: number;
                        max: number;
                    };
                };
            };
            position: "random" | "center" | "periphral";
        };
    };
}

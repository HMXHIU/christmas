import { type Prop } from "../../compendium";
import { architecture } from "./architecture";
import { consumables } from "./consumables";
import { equipment } from "./equipment";
import { landmarks } from "./landmarks";
import { quests } from "./quests";
import { weapons } from "./weapons";

export { compendium };

/**
 * `compendium` is a collection of `Prop` templates used  to create `item` instances.
 */
let compendium: Record<string, Prop> = {
    ...equipment,
    ...weapons,
    ...consumables,
    ...landmarks,
    ...architecture,
    ...quests,
};

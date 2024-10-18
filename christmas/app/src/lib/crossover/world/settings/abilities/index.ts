import type { Abilities, Ability } from "../../abilities";
import { healingAbilities } from "./healing";
import { offensiveAbilities } from "./offensive";
import { utilityAbilities } from "./utility";

export { abilities };

/**
 * `abilities` is a collection of all the `Ability` available in the game.
 */
const abilities = {
    ...offensiveAbilities,
    ...utilityAbilities,
    ...healingAbilities,
} as Record<Abilities, Ability>;

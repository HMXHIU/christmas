import type { Attributes } from "../entity";

export { BASE_ATTRIBUTES, MAX_POSSIBLE_AP };

// dex - stamina
// str - stamina
// con - health, phy resistance
// int - mana
// fth - mana, spell resistance

const MAX_POSSIBLE_AP = 8;
const BASE_ATTRIBUTES: Attributes = {
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    fth: 10,
};

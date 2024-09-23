import { JWT_SECRET_KEY } from "$env/static/private";
import type { SkillLines } from "$lib/crossover/world/skills";
import type { BarterSerialized } from "$lib/crossover/world/types";
import { signJWT, verifyJWT } from "..";

export {
    createP2PTransaction,
    verifyP2PTransaction,
    type CTA,
    type P2PGiveTransaction,
    type P2PLearnTransaction,
    type P2PTradeTransaction,
};

interface P2PTransaction {
    transaction: "trade" | "quest" | "learn" | "give";
}

// Give Transaction
interface P2PGiveTransaction extends P2PTransaction {
    transaction: "give";
    receiver: string;
    player: string;
    item: string;
}

// Learn Transaction
interface P2PLearnTransaction extends P2PTransaction {
    transaction: "learn";
    teacher: string;
    player: string;
    skill: SkillLines;
}

// Trade Transaction
interface P2PTradeTransaction extends P2PTransaction {
    transaction: "trade";
    seller: string; // empty string means anyone can fulfill the sell order
    buyer: string; // empty string means anyone can fulfill the buy order
    offer: BarterSerialized;
    receive: BarterSerialized;
}

interface CTA {
    name: string;
    description: string;
    pin: string; // also serves as the CTA id, and for targeting the CTA (eg. accept [pin])
    token: string; // p2pTransaction jwt
}

async function createP2PTransaction(
    p2pTx: P2PTransaction,
    expiresIn: number,
): Promise<string> {
    return await signJWT(p2pTx, expiresIn, JWT_SECRET_KEY);
}

async function verifyP2PTransaction(token: string): Promise<P2PTransaction> {
    return (await verifyJWT(token, JWT_SECRET_KEY)) as P2PTransaction;
}

import { JWT_SECRET_KEY } from "$env/static/private";
import type {
    PlayerAppearance,
    PlayerDemographic,
} from "$lib/crossover/world/player";
import type { SkillLines } from "$lib/crossover/world/skills";
import type { BarterSerialized } from "$lib/crossover/world/types";
import { hashObject, signJWT, verifyJWT } from "..";

export {
    createP2PTransaction,
    generateAvatarHash,
    verifyP2PTransaction,
    type CTA,
    type P2PLearnTransaction,
    type P2PTradeTransaction,
};

function generateAvatarHash({
    demographic,
    appearance,
    textures,
}: {
    demographic: PlayerDemographic;
    appearance: PlayerAppearance;
    textures: Record<string, string>;
}): { selector: string; texture: string; hash: string } {
    // Searching by using the prefix as the selector will give multiple texture combinations
    const s = hashObject({ demographic, appearance }, "md5"); // md5 is shorter
    const t = hashObject({ textures }, "md5");
    return { selector: s, texture: t, hash: `${s}_${t}` };
}

interface P2PTransaction {
    transaction: "trade" | "quest" | "learn";
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

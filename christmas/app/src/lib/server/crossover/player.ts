import { JWT_SECRET_KEY } from "$env/static/private";
import { geohashesNearby, minifiedEntity } from "$lib/crossover/utils";
import type { Actions } from "$lib/crossover/world/actions";
import type {
    PlayerAppearance,
    PlayerDemographic,
} from "$lib/crossover/world/player";
import type { SkillLines } from "$lib/crossover/world/skills";
import type { BarterSerialized } from "$lib/crossover/world/types";
import { hashObject, signJWT, verifyJWT } from "..";
import { equipmentQuerySet, fetchEntity } from "./redis";
import type { ItemEntity, PlayerEntity } from "./redis/entities";
import { publishAffectedEntitiesToPlayers } from "./utils";

export {
    createP2PTransaction,
    generateAvatarHash,
    probeEquipment,
    verifyP2PTransaction,
    type CTA,
    type P2PLearnTransaction,
    type P2PTradeTransaction,
};

async function probeEquipment(
    self: PlayerEntity,
    player: string,
): Promise<ItemEntity[]> {
    // Check if player is in range
    const targetPlayer = (await fetchEntity(player)) as PlayerEntity;
    if (targetPlayer == null) {
        return [];
    }

    // Get nearby geohashes
    const p6 = targetPlayer.loc[0].slice(0, -2);
    const nearbyGeohashes = geohashesNearby(p6);
    const isNearby = nearbyGeohashes.find((g) => self.loc[0].startsWith(g));
    if (!isNearby) {
        return [];
    }

    // Get equipped items of target player
    const equippedItems = (await equipmentQuerySet(
        targetPlayer.player,
    ).return.all()) as ItemEntity[];

    // Publish only the minified entities
    publishAffectedEntitiesToPlayers(
        equippedItems.map((e) => minifiedEntity(e, { location: true })),
        {
            publishTo: [self.player],
        },
    );

    return equippedItems;
}

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

// P2PTransaction aka CTA
interface P2PTransaction {
    message: string;
}

interface P2PActionTransaction extends P2PTransaction {
    action: Actions;
}

interface P2PLearnTransaction extends P2PActionTransaction {
    action: "learn";
    teacher: string;
    player: string;
    skill: SkillLines;
}

interface P2PTradeTransaction extends P2PActionTransaction {
    action: "trade";
    seller: string; // empty string means anyone can fulfill the sell order
    buyer: string; // empty string means anyone can fulfill the buy order
    offer: BarterSerialized;
    receive: BarterSerialized;
}

type CTATypes = "writ";

interface CTA {
    cta: CTATypes;
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

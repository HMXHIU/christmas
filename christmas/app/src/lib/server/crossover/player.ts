import { geohashesNearby, minifiedEntity } from "$lib/crossover/utils";
import type {
    PlayerAppearance,
    PlayerDemographic,
} from "$lib/crossover/world/player";
import { hashObject } from "..";
import { equipmentQuerySet, fetchEntity } from "./redis";
import type { ItemEntity, PlayerEntity } from "./redis/entities";
import { publishAffectedEntitiesToPlayers } from "./utils";

export { generateAvatarHash, probeEquipment };

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

import type { Currency } from "$lib/crossover/types";
import { minifiedEntity } from "$lib/crossover/utils";
import { actions } from "$lib/crossover/world/settings/actions";
import {
    factions,
    type Faction,
} from "$lib/crossover/world/settings/affinities";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { type Barter, type GeohashLocation } from "$lib/crossover/world/types";
import {
    type ActorEntity,
    type ItemEntity,
    type PlayerEntity,
} from "$lib/server/crossover/types";
import { setEntityBusy } from "..";
import {
    publishAffectedEntitiesToPlayers,
    publishFeedEvent,
    publishFeedEventToPlayers,
} from "../events";
import { getNearbyPlayerIds } from "../redis/queries";
import { fetchEntity, saveEntity } from "../redis/utils";
import { itemVariableValue } from "../utils";
import { barterDescription, playerHasBarterItems } from "./trade";

export { capture };

async function capture({
    self,
    target,
    offer,
    now,
}: {
    self: PlayerEntity;
    target: string;
    offer: Barter;
    now?: number;
}) {
    now = now ?? Date.now();
    let error: string | null = null;
    let controlMonument = (await fetchEntity(target)) as ItemEntity;

    // Get target
    if (!controlMonument) {
        error = `Target ${target} not found`;
    }
    // Check if can capture target
    else {
        const [ok, message] = await canCapture(self, controlMonument, offer);
        if (!ok) {
            error = message;
        }
    }

    if (error) {
        await publishFeedEvent(self.player, {
            type: "error",
            message: error,
        });
        return; // do not proceed
    }

    // Set busy
    self = (await setEntityBusy({
        entity: self,
        action: actions.capture.action,
        now,
    })) as PlayerEntity;

    // Transfer offer from player to control
    let factionInfluence = (controlMonument.vars[self.fac] as number) ?? 0;
    for (const [cur, amt] of Object.entries(offer.currency)) {
        self[cur as Currency] -= amt;
        factionInfluence += amt;
    }
    controlMonument.vars[self.fac] = factionInfluence;

    // Update controlMonument influence description
    let faction = factionInControl(controlMonument);
    if (faction) {
        controlMonument.vars["influence"] =
            `${factions[faction].name} controls this monument.`;
    } else {
        controlMonument.vars["influence"] =
            `You sense no influence from this monument.`;
    }

    // Save entities
    self = await saveEntity(self);
    controlMonument = await saveEntity(controlMonument);

    const nearbyPlayerIds = await getNearbyPlayerIds(
        self.loc[0],
        self.locT as GeohashLocation,
        self.locI,
    );

    // Publish message
    await publishFeedEventToPlayers(nearbyPlayerIds, {
        type: "message",
        message: `${factions[self.fac].name} influence grows in the area (${factionInfluence})`,
    });

    // Publish update to self
    await publishAffectedEntitiesToPlayers([
        minifiedEntity(self, { stats: true }),
    ]);

    // Publish target to nearby players
    await publishAffectedEntitiesToPlayers(
        [minifiedEntity(controlMonument, { stats: true })],
        {
            publishTo: nearbyPlayerIds,
        },
    );
}

function factionInControl(controlMonument: ItemEntity): Faction | undefined {
    // Update controlMonument influence description
    let highestInfluence = 0;
    let faction: Faction | undefined = undefined;
    for (const [fac, inf] of Object.entries(controlMonument.vars)) {
        if (
            fac in factions &&
            typeof inf === "number" &&
            inf > highestInfluence
        ) {
            highestInfluence = inf;
            faction = fac as Faction;
        }
    }
    return faction;
}

async function canCapture(
    player: PlayerEntity,
    target: ActorEntity,
    offer: Barter,
): Promise<[boolean, string]> {
    // Check if target can be captured
    if (target.prop !== "control" || !compendium[target.prop]) {
        return [false, `${target.name} is not something to be captured.`];
    }
    target = target as ItemEntity;

    // Check if offer type matches the control requirement
    const receive = await itemVariableValue(target, "receive");
    if (!receive || !(typeof receive === "string")) {
        return [false, `${target.name} cannot be captured.`];
    }

    // Check seller and player has required items/currencies
    if (!(await playerHasBarterItems(player, offer))) {
        return [false, `You do not have ${barterDescription(offer)}.`];
    }

    let influence = 0;
    for (const req of receive.split(",").map((s) => s.trim())) {
        if (req === "currency:lum" && offer.currency.lum > 0) {
            influence += offer.currency.lum;
        } else if (req === "currency:umb") {
            influence += offer.currency.umb;
        }
    }

    if (influence < 1) {
        return [
            false,
            `Your offer of ${barterDescription(offer)} is not acceptable by ${target.name}`,
        ];
    }

    return [true, ""];
}

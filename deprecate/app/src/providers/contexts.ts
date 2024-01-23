import { createContext } from "@lit/context";
import { Location } from "../../../lib/user-device-client/types";
import { AnchorClient } from "../../../lib/anchor-client/anchorClient";
import { NFTClient } from "../../../lib/nft-client/types";

export const locationContext = createContext<Location | null>(
    Symbol("user-device-client")
);

export const anchorClientContext = createContext<AnchorClient | null>(
    Symbol("anchor-client")
);

export const nftClientContext = createContext<NFTClient | null>(
    Symbol("nft-client")
);

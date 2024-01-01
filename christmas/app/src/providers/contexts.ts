import { createContext } from "@lit/context";
import { Location } from "../../../lib/user-device-client/types";
import { AnchorClient } from "../../../lib/anchor-client/anchorClient";
import { NFTStorageClient } from "../lib/nftStorageClient";

export const locationContext = createContext<Location | null>(
    Symbol("user-device-client")
);

export const anchorClientContext = createContext<AnchorClient | null>(
    Symbol("anchor-client")
);

export const nftStorageClientContext = createContext<NFTStorageClient | null>(
    Symbol("anchor-client")
);

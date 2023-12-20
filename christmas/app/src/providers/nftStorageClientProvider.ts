import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { provide } from "@lit/context";
import { createContext } from "@lit/context";
import { NFTStorageClient } from "../lib/nftStorageClient";
import { NFT_STORAGE_TOKEN } from "../lib/constants";

export const nftStorageClientContext = createContext<NFTStorageClient | null>(
    Symbol("anchor-client")
);

@customElement("nft-storage-client-provider")
export class NFTStorageClientProvider extends LitElement {
    @provide({ context: nftStorageClientContext })
    @state()
    accessor nftStorageClient: NFTStorageClient = new NFTStorageClient({
        token: NFT_STORAGE_TOKEN,
    });

    render() {
        return html`<slot></slot>`;
    }
}

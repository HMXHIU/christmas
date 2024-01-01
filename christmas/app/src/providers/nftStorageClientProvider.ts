import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { provide } from "@lit/context";
import { NFTStorageClient } from "../lib/nftStorageClient";
import { nftStorageClientContext } from "./contexts";

@customElement("nft-storage-client-provider")
export class NFTStorageClientProvider extends LitElement {
    @provide({ context: nftStorageClientContext })
    @state()
    accessor nftStorageClient: NFTStorageClient = new NFTStorageClient({
        token: process.env.NFT_STORAGE_TOKEN,
    });

    render() {
        return html`<slot></slot>`;
    }
}

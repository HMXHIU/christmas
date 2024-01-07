import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { provide } from "@lit/context";
import {
    NFTStorageClient,
    NFTStorageClientType,
} from "../../../lib/nftStorageClient";
import { nftStorageClientContext } from "./contexts";

@customElement("nft-storage-client-provider")
export class NFTStorageClientProvider extends LitElement {
    @provide({ context: nftStorageClientContext })
    @state()
    // accessor nftStorageClient: NFTStorageClient = new NFTStorageClient({
    //     token: process.env.NFT_STORAGE_TOKEN,
    //     clientType: NFTStorageClientType.NFT_STORAGE,
    // });
    accessor nftStorageClient: NFTStorageClient = new NFTStorageClient({
        accessKey: process.env.MINIO_ACCESS_KEY,
        secretKey: process.env.MINIO_SECRET_KEY,
        port: parseInt(process.env.MINIO_PORT),
        endPoint: process.env.MINIO_ENDPOINT,
        useSSL: JSON.parse(process.env.MINIO_USE_SSL),
        bucket: process.env.MINIO_BUCKET,
        clientType: NFTStorageClientType.MINIO,
    });

    render() {
        return html`<slot></slot>`;
    }
}

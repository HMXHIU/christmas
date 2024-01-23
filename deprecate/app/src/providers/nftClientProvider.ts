import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { provide } from "@lit/context";
import { NFTStorageClient } from "../../../lib/nft-client/nftStorageClient";
import { NFTMinioClient } from "../../../lib/nft-client/nftMinioClient";
import { NFTClient } from "../../../lib/nft-client/types";
import { nftClientContext } from "./contexts";

@customElement("nft-client-provider")
export class NFTStorageClientProvider extends LitElement {
    @provide({ context: nftClientContext })
    @state()
    accessor nftStorageClient: NFTClient =
        process.env.ENVIRONMENT === "development"
            ? new NFTMinioClient({
                  accessKey: process.env.MINIO_ACCESS_KEY,
                  secretKey: process.env.MINIO_SECRET_KEY,
                  port: parseInt(process.env.MINIO_PORT),
                  endPoint: process.env.MINIO_ENDPOINT,
                  useSSL: JSON.parse(process.env.MINIO_USE_SSL),
                  bucket: process.env.MINIO_BUCKET,
              })
            : new NFTStorageClient({
                  token: process.env.NFT_STORAGE_TOKEN,
              });

    render() {
        return html`<slot></slot>`;
    }
}

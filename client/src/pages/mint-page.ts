import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { ClientDevice } from "../lib/utils";
import { consume } from "@lit/context";
import { AnchorClient } from "../lib/anchor/anchorClient";
import {
  anchorClientContext,
  clientDeviceContext,
  nftStorageClientContext,
} from "../layouts/app-main";
import { CreateCouponDetail } from "../components/create-coupon";
import { NFTStorageClient } from "../lib/nftStorageClient";

@customElement("mint-page")
export class AppMint extends LitElement {
  @consume({ context: clientDeviceContext })
  @state()
  accessor clientDevice: ClientDevice | null = null;

  @consume({ context: anchorClientContext })
  @state()
  accessor anchorClient: AnchorClient | null = null;

  @consume({ context: nftStorageClientContext })
  @state()
  accessor nftStorageClient: NFTStorageClient | null = null;

  @state()
  accessor defaultRegion: string = "";

  @state()
  accessor defaultGeohash: string = "";

  async firstUpdated() {
    this.defaultRegion = this.clientDevice?.country?.code || "";
    this.defaultGeohash = this.clientDevice?.geohash || "";
  }

  async onCreateCoupon(e: CustomEvent<CreateCouponDetail>) {
    console.log("onCreateCoupon", e.detail);
    console.log(this.anchorClient);
    console.log(this.nftStorageClient);

    if (this.anchorClient && this.nftStorageClient) {
      let metadataUrl = "";
      if (e.detail.image) {
        metadataUrl = await this.nftStorageClient.store({
          name: e.detail.name,
          description: e.detail.description,
          imageFile: e.detail.image,
        });
        console.log(`Uploaded coupon metadata to ${metadataUrl}`);
      }

      await this.anchorClient.createCoupon({
        geo: e.detail.geo,
        region: e.detail.region,
        name: e.detail.name,
        symbol: "", // TODO: remove symbol or auto set to user's stall
        uri: metadataUrl,
      });
    }
  }

  render() {
    return html`
      <div>Mint Page</div>
      <create-coupon
        defaultRegion="${this.defaultRegion}"
        defaultGeohash="${this.defaultGeohash}"
        @on-create="${this.onCreateCoupon}"
      ></create-coupon>
    `;
  }
}

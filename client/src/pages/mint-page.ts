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
import { Coupon } from "../lib/anchor/anchorClient";

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

  @state()
  accessor couponSupplyBalance: [Coupon, number, number][] = [];

  async onCreateCoupon(e: CustomEvent<CreateCouponDetail>) {
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

      const tx = await this.anchorClient.createCoupon({
        geo: e.detail.geo,
        region: e.detail.region,
        name: e.detail.name,
        symbol: "", // TODO: remove symbol or auto set to user's stall
        uri: metadataUrl,
      });

      // TODO: handle failed transactions
    }
  }

  async firstUpdated() {
    // Set defaults
    this.defaultRegion = this.clientDevice?.country?.code || "";
    this.defaultGeohash = this.clientDevice?.geohash || "";

    // Get created coupons
    this.couponSupplyBalance =
      (await this.anchorClient?.getMintedCoupons()) || [];
  }

  static styles = css`
    sl-carousel {
      height: 250px;
    }
  `;

  render() {
    // TODO: Add validity period
    return html`
      <div>Mint Page</div>
      <create-coupon
        defaultRegion="${this.defaultRegion}"
        defaultGeohash="${this.defaultGeohash}"
        @on-create="${this.onCreateCoupon}"
      ></create-coupon>

      <sl-carousel class="scroll-hint" navigation style="--scroll-hint: 10%;">
        ${this.couponSupplyBalance.map(([coupon, supply, balance]) => {
          return html`
            <sl-carousel-item>
              <mint-coupon-card
                .coupon=${coupon}
                supply=${supply}
                balance=${balance}
              ></mint-coupon-card>
            </sl-carousel-item>
          `;
        })}
      </sl-carousel>
    `;
  }
}

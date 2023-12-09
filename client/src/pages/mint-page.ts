import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, state } from "lit/decorators.js";
import { ClientDevice } from "../lib/utils";
import { consume } from "@lit/context";
import { AnchorClient } from "../lib/anchor/anchorClient";
import {
  anchorClientContext,
  clientDeviceContext,
  nftStorageClientContext,
} from "../layouts/app-main";
import { CreateCouponDetail } from "../components/create-coupon-dialog";
import { NFTStorageClient } from "../lib/nftStorageClient";
import { Coupon } from "../lib/anchor/anchorClient";
import { MintCouponDetail } from "../components/mint-coupon-dialog";

@customElement("mint-page")
export class AppMint extends LitElement {
  @consume({ context: clientDeviceContext, subscribe: true })
  @state()
  accessor clientDevice: ClientDevice | null = null;

  @consume({ context: anchorClientContext, subscribe: true })
  @state()
  accessor anchorClient: AnchorClient | null = null;

  @consume({ context: nftStorageClientContext, subscribe: true })
  @state()
  accessor nftStorageClient: NFTStorageClient | null = null;

  @state()
  accessor defaultRegion: string = "";

  @state()
  accessor defaultGeohash: string = "";

  @state()
  accessor couponSupplyBalance: [Coupon, number, number][] = [];

  async fetchCouponSupplyBalance() {
    if (this.anchorClient) {
      this.couponSupplyBalance =
        (await this.anchorClient?.getMintedCoupons()) || [];
    }
  }

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

  async onMintCoupon(e: CustomEvent<MintCouponDetail>) {
    console.log(e.detail);
    if (this.anchorClient && this.nftStorageClient) {
      const { coupon, numTokens } = e.detail;

      const tx = await this.anchorClient.mintToMarket(
        coupon.account.mint,
        coupon.account.region,
        numTokens
      );

      // TODO: handle failed transactions
    }
  }

  async willUpdate(changedProperties: PropertyValues<this>) {
    // `anchorClient` and `clientDevice` might come in 2 separate `willUpdate` events
    if (
      changedProperties.has("anchorClient") ||
      changedProperties.has("clientDevice")
    ) {
      await this.fetchCouponSupplyBalance();
      // Set defaults
      this.defaultRegion = this.clientDevice?.country?.code || "";
      this.defaultGeohash = this.clientDevice?.geohash || "";
    }
  }

  static styles = css`
    sl-carousel {
      height: 250px;
    }
    sl-spinner {
      font-size: 3rem;
      --indicator-color: deeppink;
      --track-color: pink;
    }
    .loader {
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
    }
  `;

  getLoading() {
    return html`
      <div class="loader">
        <sl-spinner> </sl-spinner>
      </div>
    `;
  }

  getPage() {
    // TODO: Add validity period
    return html`
      <!-- Create coupon -->
      <create-coupon-dialog
        defaultRegion="${this.defaultRegion}"
        defaultGeohash="${this.defaultGeohash}"
        @on-create="${this.onCreateCoupon}"
      ></create-coupon-dialog>

      <!-- User's created coupons -->
      <sl-carousel class="scroll-hint" navigation style="--scroll-hint: 10%;">
        ${this.couponSupplyBalance.map(([coupon, supply, balance]) => {
          return html`
            <sl-carousel-item>
              <mint-coupon-card
                .coupon=${coupon}
                supply=${supply}
                balance=${balance}
                @on-mint=${this.onMintCoupon}
              ></mint-coupon-card>
            </sl-carousel-item>
          `;
        })}
      </sl-carousel>
    `;
  }

  render() {
    if (this.anchorClient && this.clientDevice) {
      return this.getPage();
    } else {
      return this.getLoading();
    }
  }
}

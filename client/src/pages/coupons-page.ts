import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { anchorClientContext, clientDeviceContext } from "../layouts/app-main";
import { AnchorClient, Coupon } from "../lib/anchor/anchorClient";
import { ClientDevice } from "../lib/utils";
import { ClaimCouponDetail } from "../components/coupon-card";
import { RedeemCouponDetail } from "../components/redeem-coupon-dialog";

@customElement("coupons-page")
export class AppCoupons extends LitElement {
  @consume({ context: anchorClientContext, subscribe: true })
  @state()
  accessor anchorClient: AnchorClient | null = null;

  @consume({ context: clientDeviceContext, subscribe: true })
  @state()
  accessor clientDevice: ClientDevice | null = null;

  @state()
  accessor coupons: Coupon[] = [];

  @state()
  accessor claimedCoupons: [Coupon, number][] = [];

  async onClaimCoupon(e: CustomEvent<ClaimCouponDetail>) {
    const { coupon, couponMetadata } = e.detail;
    if (this.anchorClient && this.clientDevice) {
      const region = this.clientDevice.country?.code;
      const geo = this.clientDevice.geohash;
      // Claim from market, also creates a `User` using `region` and `geo`
      await this.anchorClient.claimFromMarket(
        coupon.account.mint,
        1,
        region,
        geo
      );
      // TODO: handle error

      // Refetch claimed coupons
      await this.fetchClaimedCoupons();
    }
  }

  onRedeemCoupon(e: CustomEvent<RedeemCouponDetail>) {
    const { numTokens, coupon } = e.detail;
  }

  async fetchCoupons() {
    // Only fetch if `anchorClient` and `clientDevice` exists
    const region = this.clientDevice?.country?.code;
    if (this.anchorClient && region) {
      this.coupons = await this.anchorClient.getCoupons(region);
    }
  }

  async fetchClaimedCoupons() {
    // Only fetch if `anchorClient`
    if (this.anchorClient) {
      this.claimedCoupons = await this.anchorClient.getClaimedCoupons();
    }
  }

  async willUpdate(changedProperties: PropertyValues<this>) {
    // `anchorClient` and `clientDevice` might come in 2 separate `willUpdate` events
    if (
      changedProperties.has("anchorClient") ||
      changedProperties.has("clientDevice")
    ) {
      await this.fetchCoupons();
      await this.fetchClaimedCoupons();
    }
  }

  static styles = css`
    sl-spinner {
      font-size: 3rem;
      --indicator-color: deeppink;
      --track-color: pink;
    }
    sl-carousel::part(scroll-container) {
      height: 210px;
    }
    .app-grid {
      height: 400px;
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
    return html`
      <!-- Claimed coupons -->
      <sl-tab-group>
        <sl-tab slot="nav" panel="claimed">My Coupons (All)</sl-tab>
        <sl-tab slot="nav" panel="food">Food</sl-tab>
        <sl-tab slot="nav" panel="others">Others</sl-tab>
        <sl-tab-panel
          name="claimed"
          style="--padding: 0px; height: 250px; padding-top: 10px"
        >
          <sl-carousel
            class="scroll-hint"
            style="--aspect-ratio: 1/1;"
            slides-per-page="2"
            pagination
          >
            ${this.claimedCoupons.map(([coupon, balance]) => {
              return html`
                <sl-carousel-item>
                  <claimed-coupon-card
                    class="item"
                    .coupon=${coupon}
                    balance=${balance}
                  ></claimed-coupon-card>
                </sl-carousel-item>
              `;
            })}
          </sl-carousel>
        </sl-tab-panel>
      </sl-tab-group>
      <br />
      <!-- Market coupons -->
      <sl-tab-group>
        <sl-tab slot="nav" panel="market">Market (All)</sl-tab>
        <sl-tab slot="nav" panel="food">Food</sl-tab>
        <sl-tab slot="nav" panel="others">Others</sl-tab>
        <sl-tab-panel name="market">
          <div class="app-grid">
            ${this.coupons.map((coupon) => {
              return html`
                <coupon-card
                  class="item"
                  .coupon=${coupon}
                  @on-claim=${this.onClaimCoupon}
                ></coupon-card>
              `;
            })}
          </div>
        </sl-tab-panel>
      </sl-tab-group>
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

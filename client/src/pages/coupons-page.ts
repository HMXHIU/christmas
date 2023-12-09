import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { anchorClientContext, clientDeviceContext } from "../layouts/app-main";
import { AnchorClient, Coupon } from "../lib/anchor/anchorClient";
import { ClientDevice } from "../lib/utils";
import { ClaimCouponDetail } from "../components/coupon-card";

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

  async onClaimCoupon(e: CustomEvent<ClaimCouponDetail>) {
    console.log(e.detail);
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
      // TODO: fetch on claim success
    }
  }

  async fetchCoupons() {
    // Only fetch if `anchorClient` and `clientDevice` exists
    const region = this.clientDevice?.country?.code;
    if (this.anchorClient && region) {
      this.coupons = await this.anchorClient.getCoupons(region);
    }
  }

  async willUpdate(changedProperties: PropertyValues<this>) {
    // `anchorClient` and `clientDevice` might come in 2 separate `willUpdate` events
    if (
      changedProperties.has("anchorClient") ||
      changedProperties.has("clientDevice")
    ) {
      await this.fetchCoupons();
    }
  }

  static styles = css`
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
    return html`
      <!-- Claimed coupons -->
      <sl-tab-group>
        <sl-tab slot="nav" panel="claimed">Claimed (All)</sl-tab>
        <sl-tab slot="nav" panel="food">Food</sl-tab>
        <sl-tab slot="nav" panel="others">Others</sl-tab>
        <sl-tab-panel name="claimed">
          This is the general tab panel.
        </sl-tab-panel>
      </sl-tab-group>
      <br />
      <!-- Market coupons -->
      <sl-tab-group>
        <sl-tab slot="nav" panel="market">Market (All)</sl-tab>
        <sl-tab slot="nav" panel="food">Food</sl-tab>
        <sl-tab slot="nav" panel="others">Others</sl-tab>
        <sl-tab-panel name="market">
          <ul class="app-grid">
            ${this.coupons.map((coupon) => {
              return html`<coupon-card
                class="item"
                .coupon=${coupon}
                @on-claim=${this.onClaimCoupon}
              ></coupon-card>`;
            })}
          </ul>
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

import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Coupon, CouponMetadata } from "../lib/anchor/anchorClient";
import { getCouponMetadata } from "../lib/utils";
import { cleanString } from "../lib/anchor/utils";

@customElement("claimed-coupon-card")
export class ClaimedCouponCard extends LitElement {
  @property({ attribute: false })
  accessor coupon!: Coupon;

  @state()
  accessor couponMetadata: CouponMetadata = {
    name: "",
    description: "",
    image: "",
  };

  @property({ attribute: true, type: Number })
  accessor balance!: number;

  static styles = css`
    .card-overview {
      max-width: 300px;
    }

    .card-overview small {
      color: var(--sl-color-neutral-500);
    }

    .card-overview [slot="footer"] {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  `;

  async firstUpdated() {
    try {
      this.couponMetadata = await getCouponMetadata(this.coupon);
    } catch (error) {
      this.couponMetadata = {
        name: "",
        description: "Not Available",
        image: "",
      };
    }
  }

  render() {
    return html`
      <sl-card class="card-overview">
        <img slot="image" src="${this.couponMetadata.image}" />

        <strong>${cleanString(this.coupon.account.name)}</strong><br />
        ${this.couponMetadata.description}<br />
        <small>${cleanString(this.coupon.account.geo)}</small>
        <br />
        <small>${this.balance} remaining</small>

        <div slot="footer">
          <sl-button variant="primary" pill>Redeem</sl-button>
        </div>
      </sl-card>
    `;
  }
}

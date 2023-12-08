import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Coupon, CouponMetadata } from "../lib/anchor/anchorClient";
import { getCouponMetadata } from "../lib/utils";
import { cleanString } from "../lib/anchor/utils";

@customElement("mint-coupon-card")
export class MintCouponCard extends LitElement {
  @property({ attribute: false })
  accessor coupon!: Coupon;

  @property({ attribute: true, type: Number })
  accessor supply!: number;

  @property({ attribute: true, type: Number })
  accessor balance!: number;

  @state()
  accessor couponMetadata: CouponMetadata = {
    name: "",
    description: "",
    image: "",
  };

  static styles = css`
    .card-overview {
      width: 250px;
    }
    .card-overview small {
      color: var(--sl-color-neutral-500);
    }
    .card-overview [slot="footer"] {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0px;
    }
    .card-button {
      padding: 0px;
    }
    .card-footer {
      padding: 0px;
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
        <!-- Header -->
        <div slot="header">
          <strong>${cleanString(this.coupon.account.name)}</strong>
          <sl-tooltip content="${this.couponMetadata.description}">
            <sl-icon-button
              name="info-circle-fill"
              label="Description"
            ></sl-icon-button>
          </sl-tooltip>
        </div>
        <!-- Image -->
        ${this.couponMetadata.image
          ? html`<img slot="image" src="${this.couponMetadata.image}" />`
          : html`<sl-icon name="image-fill"></sl-icon>`}
        <!-- Footer -->
        <div slot="footer" class="card-footer">
          <sl-button variant="success" outline class="card-button">
            Add Supply (${this.balance}/${this.supply})
          </sl-button>
        </div>
      </sl-card>
    `;
  }
}

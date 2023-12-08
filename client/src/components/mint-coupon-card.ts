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
    .card-overview [slot="footer"] {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
    .card-overview::part(footer) {
      padding-top: 5px;
      padding-bottom: 5px;
    }
    .card-overview small {
      color: var(--sl-color-neutral-500);
    }
    img {
      width: 200px;
      height: 80px;
    }
    .empty-image {
      flex-grow: 3;
      width: 200px;
      height: 80px;
    }
    .card-button {
      flex: 1;
    }
    .card-info {
      flex: 2;
      text-align: left;
    }
    .description-tooltip {
      vertical-align: middle;
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

  getDescriptionTooltip() {
    return html`
      <span class="description-tooltip">
        <sl-tooltip content="${this.couponMetadata.description}">
          <sl-icon-button
            name="info-circle-fill"
            label="Description"
          ></sl-icon-button>
        </sl-tooltip>
      </span>
    `;
  }

  render() {
    return html`
      <sl-card class="card-overview">
        <!-- Image -->
        ${this.couponMetadata.image
          ? html`<img slot="image" src="${this.couponMetadata.image}" />`
          : html`<div class="empty-image">
              <sl-icon name="image-fill"></sl-icon>
            </div>`}
        <!-- Footer -->
        <div slot="footer" class="card-footer">
          <div class="card-info">
            <!-- Name -->
            <strong>${cleanString(this.coupon.account.name)}</strong
            >${this.getDescriptionTooltip()}
            <br />
            <!-- Balance -->
            <small>${this.balance} left out of ${this.supply}</small>
          </div>
          <sl-button variant="success" outline class="card-button">
            Mint
          </sl-button>
        </div>
      </sl-card>
    `;
  }
}

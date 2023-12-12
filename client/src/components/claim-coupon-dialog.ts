import { LitElement, html, css } from "lit";
import { customElement, property, state, query } from "lit/decorators.js";
import { Coupon, CouponMetadata } from "../lib/anchor/anchorClient";
import { cleanString } from "../lib/anchor/utils";

export interface ClaimCouponDetail {
  numTokens: number;
  coupon: Coupon;
}

@customElement("claim-coupon-dialog")
export class ClaimCoupon extends LitElement {
  @query("#dialog")
  accessor dialog: any;

  @query("#dialog-open")
  accessor dialogOpen: any;

  @query("#form-submit")
  accessor form: any;

  @property({ attribute: false })
  accessor coupon!: Coupon;

  @property({ attribute: false })
  accessor couponMetadata: CouponMetadata = {
    name: "",
    description: "",
    image: "",
  };

  firstUpdated() {
    // Dialog events
    this.dialogOpen.addEventListener("click", () => this.dialog.show());
  }

  onClaimCoupon() {
    // Dispatch on-redeem event
    this.dispatchEvent(
      new CustomEvent<ClaimCouponDetail>("on-claim", {
        bubbles: true,
        composed: true,
        detail: {
          numTokens: 1,
          coupon: this.coupon,
        },
      })
    );

    // Close dialog
    this.dialog.hide();
  }

  static styles = css``;

  render() {
    return html`
      <slot name="click-to-open" id="dialog-open"></slot>
      <sl-dialog
        label="Claim '${cleanString(this.coupon.account.name)}'"
        id="dialog"
      >
        <!-- Image -->
        ${this.couponMetadata.image
          ? html`<img slot="image" src="${this.couponMetadata.image}" />`
          : html`<div class="empty-image">
              <sl-icon name="image-fill"></sl-icon>
            </div>`}
        <!-- Description -->
        <p>${this.couponMetadata.description}</p>
        <!-- Claim -->
        <sl-button variant="primary" @click=${this.onClaimCoupon}
          >Claim Now</sl-button
        >
      </sl-dialog>
    `;
  }
}

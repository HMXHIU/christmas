import { LitElement, html, css } from "lit";
import { customElement, property, state, query } from "lit/decorators.js";
import { Coupon, CouponMetadata } from "../lib/anchor/anchorClient";
import { cleanString } from "../lib/anchor/utils";

export interface RedeemCouponDetail {
  numTokens: number;
  coupon: Coupon;
}

@customElement("redeem-coupon-dialog")
export class RedeemCoupon extends LitElement {
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

  @property({ attribute: true, type: String })
  accessor redemptionQRCodeURL: string = "";

  firstUpdated() {
    // Dialog events
    this.dialogOpen.addEventListener("click", () => this.dialog.show());
  }

  onRedeem() {
    // Dispatch on-redeem event
    this.dispatchEvent(
      new CustomEvent<RedeemCouponDetail>("on-redeem", {
        bubbles: true,
        composed: true,
        detail: {
          numTokens: 1,
          coupon: this.coupon,
        },
      })
    );
  }

  copyToClipboard(text: string) {
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        alert("Copied to clipboard!");
      });
    }
  }

  static styles = css``;

  getAlreadyRedeem() {
    return html`
      <!-- Redemption QR Code URL -->
      <sl-qr-code
        value="${this.redemptionQRCodeURL}"
        error-correction="H"
      ></sl-qr-code>
      <!-- Alternative original redemption URL -->
      <sl-input type="text" value="${this.redemptionQRCodeURL}" disabled>
        <sl-icon-button
          name="clipboard2-fill"
          slot="suffix"
          @click=${() => this.copyToClipboard(this.redemptionQRCodeURL)}
        ></sl-icon-button>
      </sl-input>
    `;
  }

  getRedeem() {
    return html`
      <!-- Image -->
      ${this.couponMetadata.image
        ? html`<img slot="image" src="${this.couponMetadata.image}" />`
        : html`<div class="empty-image">
            <sl-icon name="image-fill"></sl-icon>
          </div>`}
      <!-- Description -->
      <p>${this.couponMetadata.description}</p>
      <sl-divider></sl-divider>
      <p>
        This coupon will be only be valid for 15mins. Make sure you are at the
        location before redeeming.
      </p>
      <sl-button variant="primary" @click=${this.onRedeem}
        >Redeem Now</sl-button
      >
    `;
  }

  render() {
    return html`
      <slot name="click-to-open" id="dialog-open"></slot>
      <sl-dialog
        label="${this.redemptionQRCodeURL
          ? `'${cleanString(this.coupon.account.name)}' has been redeemed!`
          : `Redeem '${cleanString(this.coupon.account.name)}' now?`}"
        id="dialog"
      >
        ${this.redemptionQRCodeURL ? this.getAlreadyRedeem() : this.getRedeem()}
      </sl-dialog>
    `;
  }
}

import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { anchorClientContext, clientDeviceContext } from "../layouts/app-main";
import { AnchorClient, Coupon } from "../lib/anchor/anchorClient";
import { ClientDevice } from "../lib/utils";

@customElement("coupons-page")
export class AppCoupons extends LitElement {
  @consume({ context: anchorClientContext })
  @state()
  accessor anchorClient: AnchorClient | null = null;

  @consume({ context: clientDeviceContext })
  @state()
  accessor clientDevice: ClientDevice | null = null;

  @state()
  accessor coupons: Coupon[] = [];

  async connectedCallback() {
    super.connectedCallback();
    const region = this.clientDevice?.country?.code;
    if (this.anchorClient && region) {
      this.coupons = await this.anchorClient.getCoupons(region);
    }
  }

  render() {
    return html`
      <ul class="app-grid">
        ${this.coupons.map((coupon) => {
          return html`<coupon-card
            class="item"
            .coupon=${coupon}
          ></coupon-card>`;
        })}
      </ul>
    `;
  }
}

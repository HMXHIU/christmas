import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { Wallet } from "@solana/wallet-adapter-react";
import { anchorClientContext, clientDeviceContext } from "../layouts/app-main";
import { AnchorClient, Coupon } from "../lib/anchor/anchorClient";
import { ClientDevice } from "../lib/utils";

@customElement("app-coupons")
export class AppCoupons extends LitElement {
  @consume({ context: anchorClientContext })
  anchorClient: AnchorClient | null = null;

  @consume({ context: clientDeviceContext })
  clientDevice: ClientDevice | null = null;

  @state()
  coupons: Coupon[] = [];

  async connectedCallback() {
    super.connectedCallback();
    const region = this.clientDevice?.country?.code;
    if (this.anchorClient && region) {
      this.coupons = await this.anchorClient.getCoupons(region);
      console.log(this.coupons);
    }
  }

  render() {
    return html`
      <ul class="app-grid">
        ${this.coupons.map((coupon) => {
          return html`<li class="item">1</li>`;
        })}
      </ul>
    `;
  }
}

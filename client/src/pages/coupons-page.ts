import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { consume } from "@lit/context";
import { Wallet } from "@solana/wallet-adapter-react";
import { walletContext } from "../layouts/app-main";

@customElement("app-coupons")
export class AppCoupons extends LitElement {
  @consume({ context: walletContext })
  wallet: Wallet | null = null;

  render() {
    console.log(this.wallet);

    if (!this.wallet) {
      return html`<div></div>`;
    }

    return html`
      <ul class="app-grid">
        <li class="item">1</li>
        <li class="item">2</li>
        <li class="item">3</li>
      </ul>
    `;
  }
}

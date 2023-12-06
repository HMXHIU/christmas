import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Router } from "@vaadin/router";
import { provide } from "@lit/context";
import { Wallet } from "@solana/wallet-adapter-react";

import { walletContext } from "../components/solana-wallet";

@customElement("app-main")
export class AppMain extends LitElement {
  @provide({ context: walletContext })
  @state()
  wallet: Wallet | null = null;

  firstUpdated() {
    const router = new Router(this.shadowRoot?.querySelector("#page-route"));
    router.setRoutes([
      { path: "/mint", component: "app-mint" },
      { path: "/coupons", component: "app-coupons" },
      { path: "(.*)", component: "app-coupons" },
    ]);
  }

  onConnectWallet(e: CustomEvent) {
    this.wallet = e.detail.wallet;
  }
  onDisconnectWallet(e: CustomEvent) {
    this.wallet = null;
  }

  render() {
    return html`
      <app-header-layout>
        <app-header slot="header">
          <app-toolbar>
            <div main-title>App name</div>

            <solana-wallet
              @on-connect-wallet=${this.onConnectWallet}
              @on-disconnect-wallet=${this.onDisconnectWallet}
            >
            </solana-wallet>
          </app-toolbar>
        </app-header>
      </app-header-layout>

      <div id="page-route"></div>

      <app-footer>
        <a href="/coupons" slot="left"><sl-menu-item>Coupons</sl-menu-item></a>
        <a href="/mint" slot="right"><sl-menu-item>Mint</sl-menu-item></a>
      </app-footer>
    `;
  }
}

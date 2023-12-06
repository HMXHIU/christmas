import { LitElement, html, css, PropertyValueMap } from "lit";
import { customElement } from "lit/decorators.js";
import { Router } from "@vaadin/router";

@customElement("app-layout")
export class AppLayout extends LitElement {
  firstUpdated() {
    const router = new Router(this.shadowRoot?.querySelector("#route-outlet"));
    router.setRoutes([{ path: "/", component: "app-coupons" }]);
  }
  render() {
    return html`
      <app-header-layout>
        <app-header slot="header" fixed effects="waterfall">
          <app-toolbar>
            <div main-title>App name</div>
            <solana-wallet></solana-wallet>
          </app-toolbar>
        </app-header>

        <div id="route-outlet"></div>
      </app-header-layout>
    `;
  }
}

import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { Router } from "@vaadin/router";
import { consume } from "@lit/context";
import { AnchorClient } from "../../../lib/anchor-client/anchorClient";
import { anchorClientContext } from "../providers/anchorClientProvider";

// App Main
@customElement("app-main")
export class AppMain extends LitElement {
    @consume({ context: anchorClientContext, subscribe: true })
    @state()
    accessor anchorClient: AnchorClient | null = null;

    // Setup router
    firstUpdated() {
        const router = new Router(
            this.shadowRoot?.querySelector("#page-route")
        );
        router.setRoutes([
            { path: "/mint", component: "mint-page" },
            { path: "/coupons", component: "coupons-page" },
            { path: "(.*)", component: "coupons-page" },
        ]);
    }

    getContent() {
        return html`
            <!-- Show page-route if there wallet is connected -->
            <div
                id="page-route"
                class=${classMap({ hidden: !Boolean(this.anchorClient) })}
            ></div>
            <!-- Show onboard-wallet-page if wallet is not connected -->
            <onboard-wallet-page
                class=${classMap({ hidden: Boolean(this.anchorClient) })}
            ></onboard-wallet-page>
        `;
    }

    static styles = css`
        .hidden {
            display: none;
        }
        .toolbar {
            background-color: rgba(255, 255, 255, 0.95);
        }
        app-footer::part(bottom-nav) {
            background-color: rgba(255, 255, 255, 0.95);
        }
        .app-body {
            margin-bottom: 50px;
        }
    `;

    render() {
        return html`
            <!-- Header -->
            <app-header-layout>
                <app-header slot="header" fixed>
                    <app-toolbar class="toolbar">
                        <div main-title>App name</div>
                        <!-- Show disconnect if wallet is connected -->
                        <sl-button
                            variant="danger"
                            outline
                            class=${classMap({
                                hidden: !Boolean(this.anchorClient),
                            })}
                            @click="${() => {
                                this.anchorClient?.wallet.adapter.disconnect(); // this will trigget the `on-disconnect-wallet` event
                            }}"
                            >Disconnect</sl-button
                        >
                    </app-toolbar>
                </app-header>
                <!-- Content -->
                <div class="app-body">${this.getContent()}</div>
            </app-header-layout>

            <!-- Footer -->
            <app-footer class="footer">
                <a href="/coupons" slot="left"
                    ><sl-menu-item>Coupons</sl-menu-item></a
                >
                <a href="/mint" slot="right"
                    ><sl-menu-item>Mint</sl-menu-item></a
                >
            </app-footer>
        `;
    }
}

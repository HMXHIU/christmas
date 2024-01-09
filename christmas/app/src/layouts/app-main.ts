import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { Router } from "@vaadin/router";
import { consume } from "@lit/context";
import { AnchorClient } from "../../../lib/anchor-client/anchorClient";
import { anchorClientContext } from "../providers/contexts";

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
        .title {
            font-family: "Pacifico", cursive;
            font-size: var(--sl-font-size-x-large);
            color: var(--sl-color-red-700);
        }
        .hidden {
            display: none;
        }
        .content {
            padding-top: 60px;
            padding-bottom: 50px;
            display: flex;
            flex-direction: column; /* Ensure a column layout */
        }
        .top-navbar,
        .bottom-navbar {
            background-color: rgba(255, 255, 255, 0.95);
            color: black;
            text-align: center;
            padding: 5px;
            z-index: 100; /* Ensure it's above other elements */
            position: fixed;
            width: 100%;
            nav ul {
                list-style-type: none;
                margin: 0px;
                padding: 10px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            nav a {
                text-decoration: none;
            }
        }
        .top-navbar {
            top: 0px;
        }
        .bottom-navbar {
            bottom: 0px;
            nav ul {
                justify-content: space-evenly;
            }
        }
    `;

    render() {
        return html`
            <!-- Header -->
            <header class="top-navbar">
                <nav>
                    <ul>
                        <li><a href="/coupons" class="title">Community</a></li>
                        <li>
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
                        </li>
                    </ul>
                </nav>
            </header>

            <!-- Content -->
            <div class="content">${this.getContent()}</div>

            <!-- Footer -->
            <footer class="bottom-navbar">
                <nav>
                    <ul>
                        <li>
                            <a href="/coupons" slot="left">Coupons</a>
                        </li>
                        <li>
                            <a href="/mint" slot="right">Mint</a>
                        </li>
                    </ul>
                </nav>
            </footer>
        `;
    }
}

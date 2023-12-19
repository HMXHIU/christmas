import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { Router } from "@vaadin/router";
import { provide } from "@lit/context";
import { createContext } from "@lit/context";
import { AnchorClient } from "../../../lib/anchor-client/anchorClient";
import { ClientDevice, getClientDevice } from "../lib/utils";
import { NFTStorageClient } from "../lib/nftStorageClient";
import { NFT_STORAGE_TOKEN } from "../lib/constants";
import { WalletDetail } from "../components/solana-wallet";

// Providers
export const anchorClientContext = createContext<AnchorClient | null>(
    Symbol("anchor-client")
);
export const clientDeviceContext = createContext<ClientDevice | null>(
    Symbol("client-device")
);
export const nftStorageClientContext = createContext<NFTStorageClient | null>(
    Symbol("nft-storage")
);

// App Main
@customElement("app-main")
export class AppMain extends LitElement {
    // Providers
    @provide({ context: anchorClientContext })
    @state()
    accessor anchorClient: AnchorClient | null = null;

    @provide({ context: clientDeviceContext })
    @state()
    accessor clientDevice: ClientDevice | null = null;

    @provide({ context: nftStorageClientContext })
    @state()
    accessor nftStorageClient: NFTStorageClient = new NFTStorageClient({
        token: NFT_STORAGE_TOKEN,
    });

    async connectedCallback() {
        super.connectedCallback();

        // Create ClientDevice
        this.clientDevice = await getClientDevice();
    }

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

    async onConnectWallet(e: CustomEvent<WalletDetail>) {
        const { wallet, anchorWallet } = e.detail;
        if (wallet && anchorWallet) {
            // Create AnchorClient
            this.anchorClient = new AnchorClient({
                wallet: wallet,
                anchorWallet: anchorWallet,
            });
            console.log(
                `app-main::onConnectWallet:: ${e.detail.anchorWallet.publicKey}`
            );
        }
    }
    onDisconnectWallet(e: CustomEvent) {
        this.anchorClient = null;
        console.log(`app-main::onDisconnectWallet`);
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
                @on-connect-wallet=${this.onConnectWallet}
                @on-disconnect-wallet=${this.onDisconnectWallet}
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
                                this.anchorClient?.wallet.adapter.disconnect();
                                this.anchorClient = null;
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

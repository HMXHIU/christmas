import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { provide } from "@lit/context";
import { AnchorClient } from "../../../lib/anchor-client/anchorClient";
import { WalletDetail } from "../components/solana-wallet";
import { PROGRAM_ID } from "../lib/constants";
import { PublicKey } from "@solana/web3.js";
import { anchorClientContext } from "./contexts";

@customElement("anchor-client-provider")
export class AnchorClientProvider extends LitElement {
    /*
        Listens on a child elements `on-connect-wallet` and `on-disconnect-wallet` event to provide wallet details
    */
    @provide({ context: anchorClientContext })
    @state()
    accessor anchorClient: AnchorClient | null = null;

    async onConnectWallet(e: CustomEvent<WalletDetail>) {
        const { wallet, anchorWallet } = e.detail;
        if (wallet && anchorWallet) {
            // Create AnchorClient
            this.anchorClient = new AnchorClient({
                wallet: wallet,
                anchorWallet: anchorWallet,
                programId: new PublicKey(PROGRAM_ID),
            });
        }
    }
    onDisconnectWallet(e: CustomEvent) {
        this.anchorClient = null;
    }

    async firstUpdated() {
        this.addEventListener("on-connect-wallet", this.onConnectWallet);
        this.addEventListener("on-disconnect-wallet", this.onDisconnectWallet);
    }

    render() {
        return html`<slot></slot>`;
    }
}

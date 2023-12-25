import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
    Coupon,
    CouponMetadata,
    Account,
    TokenAccount,
    Store,
} from "../../../lib/anchor-client/types";
import { getCouponMetadata } from "../lib/utils";
import { cleanString } from "../../../lib/anchor-client/utils";
import { ParsedAccountData } from "@solana/web3.js";

@customElement("store-section")
export class StoreSection extends LitElement {
    @property({ attribute: false })
    accessor store!: Account<Store>;

    static styles = css`
        /* Styles for the coupon creation button */
        .create-coupon-button {
            width: 100px;
            height: 100px;
            border: 2px dashed #3498db; /* Dashed border with a blue color */
            border-radius: 10px; /* Rounded corners */
            background-color: transparent;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            transition: background-color 0.3s ease;
        }

        /* Hover effect to change the background color */
        .create-coupon-button:hover {
            background-color: rgba(
                52,
                152,
                219,
                0.2
            ); /* Light blue background on hover */
        }
    `;

    render() {
        return html`
            <sl-tab-group>
                <sl-tab slot="nav" panel="store">
                    ${this.store.account.name}
                </sl-tab>
                <sl-tab slot="nav" panel="info">Info</sl-tab>
                <sl-tab-panel name="store">
                    <create-coupon-dialog .store=${this.store}>
                        <button class="create-coupon-button" slot="button">
                            Create Coupon
                        </button>
                    </create-coupon-dialog>
                </sl-tab-panel>
                <sl-tab-panel name="info">
                    <p>${this.store.account.name}</p>
                    <p>${this.store.account.region}</p>
                </sl-tab-panel>
            </sl-tab-group>
        `;
    }
}

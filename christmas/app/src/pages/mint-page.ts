import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { AnchorClient } from "../../../lib/anchor-client/anchorClient";
import { Account, Coupon, Store } from "../../../lib/anchor-client/types";
import { nftStorageClientContext } from "../providers/contexts";

import { anchorClientContext } from "../providers/contexts";
import { CreateCouponDetail } from "../components/create-coupon-dialog";
import { NFTStorageClient } from "../lib/nftStorageClient";
import { MintCouponDetail } from "../components/mint-coupon-dialog";
import { CreateStoreDetail } from "../components/create-store-dialog";
import { Location } from "../../../lib/user-device-client/types";
import { locationContext } from "../providers/contexts";
import {
    STORE_NAME_SIZE,
    STRING_PREFIX_SIZE,
} from "../../../lib/anchor-client/def";

@customElement("mint-page")
export class MintPage extends LitElement {
    @consume({ context: locationContext, subscribe: true })
    @state()
    accessor location: Location | null = null;

    @consume({ context: anchorClientContext, subscribe: true })
    @state()
    accessor anchorClient: AnchorClient | null = null;

    @consume({ context: nftStorageClientContext, subscribe: true })
    @state()
    accessor nftStorageClient: NFTStorageClient | null = null;

    @state()
    accessor stores: Account<Store>[] = [];

    async fetchStores() {
        if (this.anchorClient) {
            this.stores = await this.anchorClient.getStores();
        }
    }

    async onCreateStore(e: CustomEvent<CreateStoreDetail>) {
        if (this.anchorClient && this.nftStorageClient) {
            let metadataUrl = "";

            if (e.detail.image) {
                metadataUrl = await this.nftStorageClient.store({
                    name: e.detail.name,
                    description: e.detail.description,
                    imageFile: e.detail.image,
                    additionalMetadata: {
                        address: e.detail.address,
                    },
                });
                console.log(`Uploaded coupon metadata to ${metadataUrl}`);
            }

            const tx = await this.anchorClient.createStore({
                name: e.detail.name.slice(
                    0,
                    STORE_NAME_SIZE - STRING_PREFIX_SIZE
                ), // also enforced in the form
                geo: e.detail.geo,
                region: e.detail.region,
                uri: metadataUrl,
            });

            // refetch
            this.fetchStores();

            // TODO: handle failed transactions
        }
    }

    async willUpdate(changedProperties: PropertyValues<this>) {
        if (
            changedProperties.has("anchorClient") ||
            changedProperties.has("location")
        ) {
            if (this.anchorClient && this.location) {
                // await this.fetchCouponSupplyBalance();
                await this.fetchStores();
            }
        }
    }

    static styles = css`
        sl-spinner {
            font-size: 3rem;
            --indicator-color: deeppink;
            --track-color: pink;
        }
        .loader {
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
        }
        /* Styles for the store creation button */
        .create-store-button {
            margin: 20px;
            width: 400px;
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
        .create-store-button:hover {
            background-color: rgba(
                52,
                152,
                219,
                0.2
            ); /* Light blue background on hover */
        }
    `;

    getLoading() {
        return html`
            <div class="loader">
                <sl-spinner> </sl-spinner>
            </div>
        `;
    }

    getCreateStore() {
        return html`
            <sl-divider></sl-divider>
            <create-store-dialog @on-create="${this.onCreateStore}">
                <button class="create-store-button" slot="button">
                    ${this.stores.length > 0
                        ? "Create Another Store"
                        : "Start By Creating A Store"}
                </button>
            </create-store-dialog>
        `;
    }

    getPage() {
        return html`
            ${this.stores.map((store) => {
                return html` <store-section .store=${store}> </store-section> `;
            })}
            ${this.getCreateStore()}
            <br />
        `;
    }

    render() {
        if (this.anchorClient && this.location) {
            return this.getPage();
        } else {
            return this.getLoading();
        }
    }
}

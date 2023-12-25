import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { AnchorClient } from "../../../lib/anchor-client/anchorClient";
import { Account, Coupon, Store } from "../../../lib/anchor-client/types";
import { nftStorageClientContext } from "../providers/nftStorageClientProvider";

import { anchorClientContext } from "../providers/anchorClientProvider";
import { CreateCouponDetail } from "../components/create-coupon-dialog";
import { NFTStorageClient } from "../lib/nftStorageClient";
import { MintCouponDetail } from "../components/mint-coupon-dialog";
import { CreateStoreDetail } from "../components/create-store-dialog";
import {
    locationContext,
    Location,
} from "../providers/userDeviceClientProvider";

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
                name: e.detail.name,
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
        sl-carousel {
            height: 250px;
        }
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
            <p>
                ${this.stores.length > 0
                    ? "create another store"
                    : "start by creating a store"}
            </p>
            <!-- Create store -->
            <create-store-dialog @on-create="${this.onCreateStore}">
                <sl-button slot="button">Create Store</sl-button>
            </create-store-dialog>
        `;
    }

    getPage() {
        return html`
            ${this.stores.map((store) => {
                return html` <store-section .store=${store}> </store-section> `;
            })}
            ${this.getCreateStore()}
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

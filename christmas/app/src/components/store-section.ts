import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
    Coupon,
    CouponMetadata,
    Account,
    TokenAccount,
    Store,
    StoreMetadata,
} from "../../../lib/anchor-client/types";
import { consume } from "@lit/context";
import { AnchorClient } from "../../../lib/anchor-client/anchorClient";
import { anchorClientContext } from "../providers/anchorClientProvider";
import { getCouponMetadata, getStoreMetadata } from "../lib/utils";
import { cleanString } from "../../../lib/anchor-client/utils";
import { ParsedAccountData } from "@solana/web3.js";
import { nftStorageClientContext } from "../providers/nftStorageClientProvider";
import { NFTStorageClient } from "../lib/nftStorageClient";
import { MintCouponDetail } from "../components/mint-coupon-dialog";
import { CreateCouponDetail } from "../components/create-coupon-dialog";

@customElement("store-section")
export class StoreSection extends LitElement {
    @consume({ context: anchorClientContext, subscribe: true })
    @state()
    accessor anchorClient: AnchorClient | null = null;

    @consume({ context: nftStorageClientContext, subscribe: true })
    @state()
    accessor nftStorageClient: NFTStorageClient | null = null;

    @property({ attribute: false })
    accessor store!: Account<Store>;

    @state()
    accessor storeMetadata: StoreMetadata;

    @state()
    accessor couponSupplyBalance: [Account<Coupon>, number, number][] = [];

    async fetchCouponSupplyBalance() {
        if (this.anchorClient) {
            this.couponSupplyBalance =
                (await this.anchorClient.getMintedCoupons(
                    this.store.publicKey
                )) || [];
        }
    }

    async fetchStoreMetadata() {
        // Fetch store metadata
        this.storeMetadata = await getStoreMetadata(this.store);
    }

    async willUpdate(changedProperties: PropertyValues<this>) {
        if (changedProperties.has("anchorClient")) {
            if (this.anchorClient) {
                await this.fetchCouponSupplyBalance();
                await this.fetchStoreMetadata();
            }
        }
    }

    static styles = css`
        /* Styles for the coupon creation button */
        .create-coupon-button {
            width: 120px;
            height: 210px;
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

    async onCreateCoupon(e: CustomEvent<CreateCouponDetail>) {
        if (this.anchorClient && this.nftStorageClient) {
            let metadataUrl = "";
            if (e.detail.image) {
                metadataUrl = await this.nftStorageClient.store({
                    name: e.detail.name,
                    description: e.detail.description,
                    imageFile: e.detail.image,
                });
                console.log(`Uploaded coupon metadata to ${metadataUrl}`);
            }

            await this.anchorClient.createCoupon({
                geo: e.detail.geo,
                region: e.detail.region,
                name: e.detail.name,
                store: e.detail.store.publicKey, // TODO: CREATE STORE
                symbol: "", // TODO: remove symbol or auto set to user's stall
                uri: metadataUrl,
            });

            // TODO: handle failed transactions

            await this.fetchCouponSupplyBalance();
        }
    }

    async onMintCoupon(e: CustomEvent<MintCouponDetail>) {
        if (this.anchorClient && this.nftStorageClient) {
            const { coupon, numTokens } = e.detail;

            await this.anchorClient.mintToMarket(
                coupon.account.mint,
                coupon.account.region,
                numTokens
            );

            // TODO: handle failed transactions

            await this.fetchCouponSupplyBalance();
        }
    }

    render() {
        return html`
            <sl-tab-group>
                <sl-tab slot="nav" panel="store">
                    ${this.store.account.name}
                </sl-tab>
                <sl-tab slot="nav" panel="info">Store Information</sl-tab>
                <sl-tab-panel name="store">
                    <side-scoller>
                        <create-coupon-dialog
                            .store=${this.store}
                            @on-create="${this.onCreateCoupon}"
                        >
                            <button class="create-coupon-button" slot="button">
                                Create Coupon
                            </button>
                        </create-coupon-dialog>
                        ${this.couponSupplyBalance.map(
                            ([coupon, supply, balance]) => {
                                return html`
                                    <mint-coupon-card
                                        .coupon=${coupon}
                                        supply=${supply}
                                        balance=${balance}
                                        @on-mint=${this.onMintCoupon}
                                    ></mint-coupon-card>
                                `;
                            }
                        )}
                    </side-scoller>
                </sl-tab-panel>
                <sl-tab-panel name="info">
                    <p>${this.store.account.name}</p>
                    <p>${this.storeMetadata?.description}</p>
                    <p>${this.storeMetadata?.address}</p>
                    <img class="store-image" src=${this.storeMetadata?.image} />
                </sl-tab-panel>
            </sl-tab-group>
        `;
    }
}

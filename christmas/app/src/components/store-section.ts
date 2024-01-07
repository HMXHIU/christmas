import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
    Coupon,
    Account,
    Store,
    StoreMetadata,
} from "../../../lib/anchor-client/types";
import { consume } from "@lit/context";
import { AnchorClient } from "../../../lib/anchor-client/anchorClient";
import { anchorClientContext } from "../providers/contexts";
import { getStoreMetadata } from "../lib/utils";
import { nftClientContext } from "../providers/contexts";
import { NFTClient } from "../../../lib/nft-client/types";
import { MintCouponDetail } from "../components/mint-coupon-dialog";
import { CreateCouponDetail } from "../components/create-coupon-dialog";
import {
    COUPON_NAME_SIZE,
    STRING_PREFIX_SIZE,
} from "../../../lib/anchor-client/def";

@customElement("store-section")
export class StoreSection extends LitElement {
    @consume({ context: anchorClientContext, subscribe: true })
    @state()
    accessor anchorClient: AnchorClient | null = null;

    @consume({ context: nftClientContext, subscribe: true })
    @state()
    accessor nftClient: NFTClient | null = null;

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
        this.storeMetadata = await getStoreMetadata(this.store.account);
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
        if (this.anchorClient && this.nftClient) {
            let metadataUrl = "";

            // Upload coupon image to nft storage
            if (e.detail.image) {
                metadataUrl = await this.nftClient.store({
                    name: e.detail.name,
                    description: e.detail.description,
                    imageFile: e.detail.image,
                });
                console.log(`Uploaded coupon metadata to ${metadataUrl}`);
            }

            // Create coupon
            await this.anchorClient.createCoupon({
                geo: e.detail.geo,
                region: e.detail.region,
                name: e.detail.name.slice(
                    0,
                    COUPON_NAME_SIZE - STRING_PREFIX_SIZE
                ), // also enforced in form
                store: e.detail.store.publicKey,
                symbol: "",
                uri: metadataUrl,
                validFrom: e.detail.validFrom,
                validTo: e.detail.validTo,
            });

            // TODO: handle failed transactions

            await this.fetchCouponSupplyBalance();
        }
    }

    async onMintCoupon(e: CustomEvent<MintCouponDetail>) {
        if (this.anchorClient && this.nftClient) {
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
                    <p>${this.store.account.region}</p>
                    <p>${this.storeMetadata?.address}</p>
                    <img class="store-image" src=${this.storeMetadata?.image} />
                </sl-tab-panel>
            </sl-tab-group>
        `;
    }
}

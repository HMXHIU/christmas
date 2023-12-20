import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { AnchorClient } from "../../../lib/anchor-client/anchorClient";
import { Account, Coupon } from "../../../lib/anchor-client/types";
import { nftStorageClientContext } from "../providers/nftStorageClientProvider";

import { anchorClientContext } from "../providers/anchorClientProvider";
import { CreateCouponDetail } from "../components/create-coupon-dialog";
import { NFTStorageClient } from "../lib/nftStorageClient";
import { MintCouponDetail } from "../components/mint-coupon-dialog";
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
    accessor defaultRegion: string = "";

    @state()
    accessor defaultGeohash: string = "";

    @state()
    accessor couponSupplyBalance: [Account<Coupon>, number, number][] = [];

    async fetchCouponSupplyBalance() {
        if (this.anchorClient) {
            this.couponSupplyBalance =
                (await this.anchorClient?.getMintedCoupons()) || [];
        }
    }

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

            const tx = await this.anchorClient.createCoupon({
                geo: e.detail.geo,
                region: e.detail.region,
                name: e.detail.name,
                symbol: "", // TODO: remove symbol or auto set to user's stall
                uri: metadataUrl,
            });

            // TODO: handle failed transactions
        }
    }

    async onMintCoupon(e: CustomEvent<MintCouponDetail>) {
        if (this.anchorClient && this.nftStorageClient) {
            const { coupon, numTokens } = e.detail;

            const tx = await this.anchorClient.mintToMarket(
                coupon.account.mint,
                coupon.account.region,
                numTokens
            );

            // TODO: handle failed transactions
            this.fetchCouponSupplyBalance();
        }
    }

    async willUpdate(changedProperties: PropertyValues<this>) {
        if (
            changedProperties.has("anchorClient") ||
            changedProperties.has("location")
        ) {
            if (this.anchorClient && this.location) {
                await this.fetchCouponSupplyBalance();
                // Set defaults
                this.defaultRegion = this.location.country.code || "";
                this.defaultGeohash = this.location.geohash || "";
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

    getPage() {
        // TODO: Add validity period
        return html`
            <!-- Create coupon -->
            <create-coupon-dialog
                defaultRegion="${this.defaultRegion}"
                defaultGeohash="${this.defaultGeohash}"
                @on-create="${this.onCreateCoupon}"
            ></create-coupon-dialog>

            <!-- User's created coupons -->
            <sl-carousel
                class="scroll-hint"
                navigation
                style="--scroll-hint: 10%;"
            >
                ${this.couponSupplyBalance.map(([coupon, supply, balance]) => {
                    return html`
                        <sl-carousel-item>
                            <mint-coupon-card
                                .coupon=${coupon}
                                supply=${supply}
                                balance=${balance}
                                @on-mint=${this.onMintCoupon}
                            ></mint-coupon-card>
                        </sl-carousel-item>
                    `;
                })}
            </sl-carousel>
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

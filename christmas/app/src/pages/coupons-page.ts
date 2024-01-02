import { LitElement, html, css, PropertyValues, PropertyValueMap } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { anchorClientContext } from "../providers/contexts";
import { AnchorClient } from "../../../lib/anchor-client/anchorClient";
import {
    Coupon,
    Account,
    TokenAccount,
} from "../../../lib/anchor-client/types";
import { ClaimCouponDetail } from "../components/claim-coupon-dialog";
import { RedeemCouponDetail } from "../components/redeem-coupon-dialog";
import { locationContext } from "../providers/contexts";
import { Location } from "../../../lib/user-device-client/types";

@customElement("coupons-page")
export class CouponsPage extends LitElement {
    @consume({ context: anchorClientContext, subscribe: true })
    @state()
    accessor anchorClient: AnchorClient | null = null;

    @consume({ context: locationContext, subscribe: true })
    @state()
    accessor location: Location | null = null;

    @state()
    accessor coupons: [Account<Coupon>, TokenAccount][] = [];

    @state()
    accessor claimedCoupons: [Account<Coupon>, number][] = [];

    async onClaimCoupon(e: CustomEvent<ClaimCouponDetail>) {
        const { coupon, numTokens } = e.detail;
        if (this.anchorClient && this.location?.country?.code) {
            // Claim from market, also creates a `User` using `region` and `geo`
            await this.anchorClient.claimFromMarket(
                coupon.account.mint,
                numTokens,
                this.location.country.code,
                this.location.geohash
            );
            // TODO: handle error

            // Refetch claimed coupons
            await this.fetchClaimedCoupons();
        }
    }

    onRedeemCoupon(e: CustomEvent<RedeemCouponDetail>) {
        const { numTokens, coupon } = e.detail;
    }

    async fetchCoupons() {
        // Only fetch if `anchorClient` and `location` exists
        if (this.anchorClient && this.location?.country?.code) {
            this.coupons = await this.anchorClient.getCoupons(
                this.location.country.code
            );
        }
    }

    async fetchClaimedCoupons() {
        // Only fetch if `anchorClient`
        if (this.anchorClient) {
            this.claimedCoupons = await this.anchorClient.getClaimedCoupons();
        }
    }

    async firstUpdated() {
        await this.fetchCoupons();
        await this.fetchClaimedCoupons();
    }

    async willUpdate(changedProperties: PropertyValues<this>) {
        if (
            changedProperties.has("anchorClient") ||
            changedProperties.has("location")
        ) {
            if (this.anchorClient && this.location) {
                await this.fetchCoupons();
                await this.fetchClaimedCoupons();
            }
        }
    }

    static styles = css`
        .my-coupons-panel {
            --padding: 0px;
            padding-top: 5px;
            padding-bottom: 5px;
        }
        .my-coupons-panel::part(base) {
            display: flex;
        }
        .market-coupons-panel {
            overflow-x: hidden; /* Disable side scrolling */
            overflow-y: hidden; /* Disable vertical scrolling */
        }
        .market-coupons-panel::part(base) {
            display: flex;
            flex-wrap: wrap;
        }
    `;

    getPage() {
        return html`
            <!-- Claimed coupons -->
            <sl-tab-group>
                <sl-tab slot="nav" panel="claimed">
                    My Coupons (${this.claimedCoupons.length})
                </sl-tab>
                <sl-tab-panel name="claimed" class="my-coupons-panel">
                    ${this.claimedCoupons.map(([coupon, balance]) => {
                        return html`
                            <claimed-coupon-card
                                class="item"
                                .coupon=${coupon}
                                balance=${balance}
                            ></claimed-coupon-card>
                        `;
                    })}
                </sl-tab-panel>
            </sl-tab-group>
            <br />
            <!-- Market coupons -->
            <sl-tab-group>
                <sl-tab slot="nav" panel="market">Market (All)</sl-tab>
                <sl-tab slot="nav" panel="food">Food</sl-tab>
                <sl-tab slot="nav" panel="others">Others</sl-tab>
                <sl-tab-panel name="market" class="market-coupons-panel">
                    ${this.coupons.map(([coupon, tokenAccount]) => {
                        return html`
                            <coupon-card
                                class="item"
                                .coupon=${coupon}
                                .tokenAccount=${tokenAccount}
                                @on-claim=${this.onClaimCoupon}
                            ></coupon-card>
                        `;
                    })}
                </sl-tab-panel>
            </sl-tab-group>
        `;
    }

    render() {
        if (this.anchorClient && this.location) {
            return this.getPage();
        } else {
            return html`<loading-page></loading-page>`;
        }
    }
}

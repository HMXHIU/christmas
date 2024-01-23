import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
    Coupon,
    CouponMetadata,
    Account,
    TokenAccount,
    StoreMetadata,
    Store,
} from "../../../lib/anchor-client/types";
import { getCouponMetadata, getStoreMetadata } from "../lib/utils";
import { ParsedAccountData } from "@solana/web3.js";
import { anchorClientContext } from "../providers/contexts";
import { consume } from "@lit/context";
import { AnchorClient } from "../../../lib/anchor-client/anchorClient";
import { calculateDistance, timeStampToDate } from "../../../lib/utils";
import { locationContext } from "../providers/contexts";
import { Location } from "../../../lib/user-device-client/types";

@customElement("coupon-card")
export class CouponCard extends LitElement {
    @consume({ context: locationContext, subscribe: true })
    @state()
    accessor location: Location | null = null;

    @consume({ context: anchorClientContext, subscribe: true })
    @state()
    accessor anchorClient: AnchorClient | null = null;

    @property({ attribute: false })
    accessor coupon!: Account<Coupon>;

    @property({ attribute: false })
    accessor tokenAccount!: TokenAccount;

    @state()
    accessor couponMetadata: CouponMetadata = {
        name: "",
        description: "",
        image: "",
    };

    @state()
    accessor storeMetadata: StoreMetadata;

    @state()
    accessor store: Store;

    async fetchStoreMetadata() {
        this.store = await this.anchorClient.getStoreByPda(
            this.coupon.account.store
        );
        this.storeMetadata = await getStoreMetadata(this.store);
    }
    async fetchCouponMetadata() {
        this.couponMetadata = await getCouponMetadata(this.coupon.account);
    }

    async willUpdate(changedProperties: PropertyValues<this>) {
        if (
            changedProperties.has("anchorClient") ||
            changedProperties.has("location")
        ) {
            if (this.anchorClient && this.location) {
                await this.fetchCouponMetadata();
                await this.fetchStoreMetadata();
            }
        }
    }

    static styles = css``;

    getDistance() {
        const distance = calculateDistance(
            this.storeMetadata?.latitude,
            this.storeMetadata?.longitude,
            this.location?.geolocationCoordinates?.latitude,
            this.location?.geolocationCoordinates?.longitude
        );

        if (distance) {
            if (distance < 0.1) {
                return html` <p class="store-distance">nearby</p> `;
            } else if (distance < 1) {
                return html`
                    <p class="store-distance">
                        ${Math.trunc(distance * 1000)}m
                    </p>
                `;
            }
            return html`
                <p class="store-distance">${Math.round(distance)}km</p>
            `;
        }
        return html``;
    }

    render() {
        const tokenAccountData = (
            this.tokenAccount.account.data as ParsedAccountData
        ).parsed.info;

        const validTo = timeStampToDate(this.coupon.account.validTo);

        const distance = calculateDistance(
            this.storeMetadata?.latitude,
            this.storeMetadata?.longitude,
            this.location?.geolocationCoordinates?.latitude,
            this.location?.geolocationCoordinates?.longitude
        );

        return html`
            <claim-coupon-dialog
                .coupon=${this.coupon}
                .couponMetadata=${this.couponMetadata}
            >
                <coupon-base-card
                    slot="click-to-open"
                    distance=${distance}
                    couponImageUrl=${this.couponMetadata.image}
                    couponName=${this.coupon.account.name}
                    remaining=${tokenAccountData.tokenAmount.uiAmount}
                    storeImageUrl=${this.storeMetadata?.image}
                    storeName=${this.storeMetadata?.name}
                    storeAddress=${this.storeMetadata?.address}
                    .expiry=${validTo}
                ></coupon-base-card>
            </claim-coupon-dialog>
        `;
    }
}

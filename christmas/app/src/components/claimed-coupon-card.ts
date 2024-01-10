import { LitElement, html, PropertyValues, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
    Coupon,
    CouponMetadata,
    Account,
    Store,
    StoreMetadata,
} from "../../../lib/anchor-client/types";
import { AnchorClient } from "../../../lib/anchor-client/anchorClient";
import { getCouponMetadata, getStoreMetadata } from "../lib/utils";
import { RedeemCouponDetail } from "../components/redeem-coupon-dialog";
import { anchorClientContext } from "../providers/contexts";
import { consume } from "@lit/context";
import { generateQRCodeURL } from "../lib/utils";
import { calculateDistance, timeStampToDate } from "../../../lib/utils";
import { locationContext } from "../providers/contexts";
import { Location } from "../../../lib/user-device-client/types";

@customElement("claimed-coupon-card")
export class ClaimedCouponCard extends LitElement {
    @consume({ context: locationContext, subscribe: true })
    @state()
    accessor location: Location | null = null;

    @consume({ context: anchorClientContext, subscribe: true })
    @state()
    accessor anchorClient: AnchorClient | null = null;

    @property({ attribute: false })
    accessor coupon!: Account<Coupon>;

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

    @state()
    accessor redemptionQRCodeURL: string = "";

    @property({ attribute: true, type: Number })
    accessor balance!: number;

    async fetchStoreMetadata() {
        this.store = await this.anchorClient.getStoreByPda(
            this.coupon.account.store
        );
        this.storeMetadata = await getStoreMetadata(this.store);
    }

    async fetchCouponMetadata() {
        this.couponMetadata = await getCouponMetadata(this.coupon.account);
    }

    async onRedeemCoupon(e: CustomEvent<RedeemCouponDetail>) {
        const { numTokens, coupon } = e.detail;

        if (this.anchorClient) {
            // Redeem coupon
            const transactionResult = await this.anchorClient.redeemCoupon({
                coupon: coupon.publicKey,
                mint: coupon.account.mint,
                numTokens,
            });

            // Generate and set redemptionQRCodeURL
            this.redemptionQRCodeURL = generateQRCodeURL({
                signature: transactionResult.signature,
                wallet: this.anchorClient.anchorWallet.publicKey.toString(),
                mint: coupon.account.mint.toString(),
                numTokens: String(numTokens),
            });
            console.log(`redemptionQRCodeURL: ${this.redemptionQRCodeURL}`);
        }
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

    render() {
        const validTo = timeStampToDate(this.coupon.account.validTo);

        const distance = calculateDistance(
            this.storeMetadata?.latitude,
            this.storeMetadata?.longitude,
            this.location?.geolocationCoordinates?.latitude,
            this.location?.geolocationCoordinates?.longitude
        );

        return html`
            <redeem-coupon-dialog
                .coupon=${this.coupon}
                .couponMetadata=${this.couponMetadata}
                redemptionQRCodeURL=${this.redemptionQRCodeURL}
                @on-redeem=${this.onRedeemCoupon}
            >
                <coupon-base-card
                    slot="click-to-open"
                    couponImageUrl=${this.couponMetadata.image}
                    couponName=${this.coupon.account.name}
                    distance=${distance}
                    remaining=${this.balance}
                    storeImageUrl=${this.storeMetadata?.image}
                    storeName=${this.storeMetadata?.name}
                    storeAddress=${this.storeMetadata?.address}
                    .expiry=${validTo}
                ></coupon-base-card>
            </redeem-coupon-dialog>
        `;
    }
}

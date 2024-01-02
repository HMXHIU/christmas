import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
    Coupon,
    CouponMetadata,
    Account,
} from "../../../lib/anchor-client/types";
import { AnchorClient } from "../../../lib/anchor-client/anchorClient";
import { getCouponMetadata } from "../lib/utils";
import { cleanString } from "../../../lib/anchor-client/utils";
import { RedeemCouponDetail } from "../components/redeem-coupon-dialog";
import { anchorClientContext } from "../providers/contexts";
import { consume } from "@lit/context";
import { generateQRCodeURL } from "../lib/utils";

@customElement("claimed-coupon-card")
export class ClaimedCouponCard extends LitElement {
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
    accessor redemptionQRCodeURL: string = "";

    @property({ attribute: true, type: Number })
    accessor balance!: number;

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

    static styles = css`
        .card-overview {
            max-width: 300px;
            margin: 10px;
        }
        .card-overview small {
            color: var(--sl-color-neutral-500);
        }
        .card-overview::part(footer) {
            padding-top: 7px;
            padding-bottom: 7px;
        }
        .card-overview [slot="footer"] {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .coupon-info {
            margin: 0px;
        }
        img {
            width: 180px;
            height: 100px;
            flex: 3;
        }
        .empty-image {
            width: 180px;
            height: 100px;
            flex: 3;
        }
    `;

    async firstUpdated() {
        try {
            this.couponMetadata = await getCouponMetadata(this.coupon);
        } catch (error) {
            this.couponMetadata = {
                name: "",
                description: "Not Available",
                image: "",
            };
        }
    }

    render() {
        return html`
            <redeem-coupon-dialog
                .coupon=${this.coupon}
                .couponMetadata=${this.couponMetadata}
                redemptionQRCodeURL=${this.redemptionQRCodeURL}
                @on-redeem=${this.onRedeemCoupon}
            >
                <sl-card
                    class="card-overview"
                    slot="click-to-open"
                    part="card-overview"
                >
                    <!-- Image -->
                    ${this.couponMetadata.image
                        ? html`<img
                              slot="image"
                              src="${this.couponMetadata.image}"
                          />`
                        : html`<div class="empty-image">
                              <sl-icon name="image-fill"></sl-icon>
                          </div>`}
                    <!-- Coupon details -->
                    <div slot="footer">
                        <p class="coupon-info">
                            <strong
                                >${cleanString(
                                    this.coupon.account.name
                                )}</strong
                            >
                            <br />
                            <small>${this.balance} remaining</small>
                        </p>
                    </div>
                </sl-card>
            </redeem-coupon-dialog>
        `;
    }
}

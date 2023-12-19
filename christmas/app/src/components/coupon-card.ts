import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
    Coupon,
    CouponMetadata,
} from "../../../lib/anchor-client/anchorClient";
import { getCouponMetadata } from "../lib/utils";
import { cleanString } from "../../../lib/anchor-client/utils";
import { ParsedAccountData } from "@solana/web3.js";

@customElement("coupon-card")
export class CouponCard extends LitElement {
    @property({ attribute: false })
    accessor coupon!: Coupon;

    @state()
    accessor couponMetadata: CouponMetadata = {
        name: "",
        description: "",
        image: "",
    };

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

    static styles = css`
        .card-overview {
            max-width: 350px;
        }
        .card-overview [slot="footer"] {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .card-overview small {
            color: var(--sl-color-neutral-500);
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

    render() {
        return html`
            <claim-coupon-dialog
                .coupon=${this.coupon}
                .couponMetadata=${this.couponMetadata}
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

                    <!-- Info -->
                    <div slot="footer">
                        <p class="coupon-info">
                            <strong
                                >${cleanString(
                                    this.coupon.account.name
                                )}</strong
                            ><br />
                            <small
                                >${this.coupon.tokenAccountData?.parsed.info
                                    .tokenAmount.uiAmount}
                                remaining</small
                            >
                        </p>
                    </div>
                </sl-card>
            </claim-coupon-dialog>
        `;
    }
}

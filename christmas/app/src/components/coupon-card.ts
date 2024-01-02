import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
    Coupon,
    CouponMetadata,
    Account,
    TokenAccount,
} from "../../../lib/anchor-client/types";
import { getCouponMetadata } from "../lib/utils";
import { cleanString } from "../../../lib/anchor-client/utils";
import { ParsedAccountData } from "@solana/web3.js";

@customElement("coupon-card")
export class CouponCard extends LitElement {
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
        :host {
            display: block;
            margin: 10px 0px 0px 10px;
        }
        sl-card::part(base) {
            width: var(--coupon-card-width);
            height: var(--coupon-card-height);
            margin: 0px;
        }
        sl-card [slot="footer"] {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        sl-card small {
            color: var(--sl-color-neutral-500);
        }
        .coupon-info {
            margin: 0px;
        }
        .coupon-image,
        .empty-image {
            height: var(--coupon-card-image-height);
            max-height: 100%;
            object-fit: contain; /* Maintain aspect ratio and fill container */
        }
        .empty-image {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            sl-icon {
                flex: 1;
            }
        }
    `;

    render() {
        const tokenAccountData = (
            this.tokenAccount.account.data as ParsedAccountData
        ).parsed.info;

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
                              class="coupon-image"
                              slot="image"
                              src="${this.couponMetadata.image}"
                          />`
                        : html`
                              <div class="empty-image" slot="image">
                                  <sl-icon name="image-fill"></sl-icon>
                              </div>
                          `}
                    <!-- Info -->
                    <div slot="footer">
                        <p class="coupon-info">
                            <strong
                                >${cleanString(
                                    this.coupon.account.name
                                )}</strong
                            ><br />
                            <small
                                >${tokenAccountData.tokenAmount.uiAmount}
                                remaining</small
                            >
                        </p>
                    </div>
                </sl-card>
            </claim-coupon-dialog>
        `;
    }
}

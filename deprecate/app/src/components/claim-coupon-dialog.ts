import { LitElement, html, css } from "lit";
import { customElement, property, state, query } from "lit/decorators.js";
import {
    Coupon,
    Account,
    CouponMetadata,
} from "../../../lib/anchor-client/types";
import { cleanString } from "../../../lib/anchor-client/utils";

export interface ClaimCouponDetail {
    numTokens: number;
    coupon: Account<Coupon>;
}

@customElement("claim-coupon-dialog")
export class ClaimCoupon extends LitElement {
    @query("#dialog")
    accessor dialog: any;

    @query("#dialog-open")
    accessor dialogOpen: any;

    @query("#form-submit")
    accessor form: any;

    @property({ attribute: false })
    accessor coupon!: Account<Coupon>;

    @property({ attribute: false })
    accessor couponMetadata!: CouponMetadata;

    firstUpdated() {
        // Dialog events
        this.dialogOpen.addEventListener("click", () => this.dialog.show());
    }

    onClaimCoupon() {
        // Dispatch on-redeem event
        this.dispatchEvent(
            new CustomEvent<ClaimCouponDetail>("on-claim", {
                bubbles: true,
                composed: true,
                detail: {
                    numTokens: 1,
                    coupon: this.coupon,
                },
            })
        );

        // Close dialog
        this.dialog.hide();
    }

    static styles = css`
        .empty-image,
        .coupon-image {
            width: 100%;
        }
        .empty-image {
            display: flex;
            align-items: center;
            justify-content: center;
            sl-icon {
                flex: 1;
            }
        }
    `;

    getImage() {
        if (this.couponMetadata.image) {
            return html`<img
                class="coupon-image"
                src=${this.couponMetadata.image}
            />`;
        } else {
            return html`
                <div class="empty-image">
                    <sl-icon name="image-fill"></sl-icon>
                </div>
            `;
        }
    }

    render() {
        return html`
            <slot name="click-to-open" id="dialog-open"></slot>
            <sl-dialog
                label="Claim '${cleanString(this.coupon.account.name)}'"
                id="dialog"
            >
                <!-- Image -->
                ${this.getImage()}
                <!-- Description -->
                <p>${this.couponMetadata.description}</p>
                <!-- Claim -->
                <sl-button variant="primary" @click=${this.onClaimCoupon}
                    >Claim Now</sl-button
                >
            </sl-dialog>
        `;
    }
}

import { LitElement, html, css } from "lit";
import { customElement, property, state, query } from "lit/decorators.js";
import {
    Coupon,
    CouponMetadata,
} from "../../../lib/anchor-client/anchorClient";
import { cleanString } from "../../../lib/anchor-client/utils";

export interface MintCouponDetail {
    numTokens: number;
    coupon: Coupon;
}

@customElement("mint-coupon-dialog")
export class MintCoupon extends LitElement {
    @query("#dialog")
    accessor dialog: any;

    @query("#form-submit")
    accessor form: any;

    @property({ attribute: true, type: Number })
    accessor supply!: number;

    @property({ attribute: true, type: Number })
    accessor balance!: number;

    @property({ attribute: false })
    accessor coupon!: Coupon;

    @property({ attribute: false })
    accessor couponMetadata: CouponMetadata = {
        name: "",
        description: "",
        image: "",
    };

    onSubmit(e: CustomEvent) {
        // Dispatch on-create event
        this.dispatchEvent(
            new CustomEvent<MintCouponDetail>("on-mint", {
                bubbles: true,
                composed: true,
                detail: {
                    numTokens: parseInt(e.detail.get("numTokens") as string),
                    coupon: this.coupon,
                },
            })
        );

        // Close dialog
        this.dialog.hide();
    }

    static styles = css``;

    render() {
        return html`
            <sl-button
                variant="success"
                outline
                id="dialog-open"
                @click=${() => {
                    this.dialog.show();
                }}
            >
                Mint
            </sl-button>
            <sl-dialog
                label="Mint ${cleanString(this.coupon.account.name)}"
                id="dialog"
            >
                <form-event @on-submit=${this.onSubmit}>
                    <form
                        class="input-validation-required"
                        id="form-submit"
                        slot="form"
                        action="submit"
                    >
                        <sl-textarea
                            name="description"
                            label="Description"
                            disabled
                        >
                            ${this.couponMetadata.description}
                        </sl-textarea>
                        <br />
                        <sl-input
                            name="numTokens"
                            type="number"
                            label="Number of Coupons"
                            min=${1}
                            value=${1}
                            required
                            help-text="${this.balance} left out of ${this
                                .supply}"
                        ></sl-input>
                        <br /><br />
                        <sl-button type="submit" variant="primary"
                            >Submit</sl-button
                        >
                        <sl-button
                            variant="primary"
                            id="dialog-close"
                            @click=${() => this.dialog.hide()}
                            >Close</sl-button
                        >
                    </form>
                </form-event>
            </sl-dialog>
        `;
    }
}

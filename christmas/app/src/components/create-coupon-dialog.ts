import { LitElement, html, css } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { Account, Store } from "../../../lib/anchor-client/types";
import {
    COUPON_NAME_SIZE,
    STRING_PREFIX_SIZE,
} from "../../../lib/anchor-client/def";

export interface CreateCouponDetail {
    name: string;
    description: string;
    image: File | null;
    region: string;
    geo: string;
    store: Account<Store>;
    validFrom: Date;
    validTo: Date;
}

@customElement("create-coupon-dialog")
export class CreateCoupon extends LitElement {
    @query('slot[name="button"]')
    accessor buttonSlot: any;

    @query("#dialog")
    accessor dialog: any;

    @query("#image-input")
    accessor imageInput: any;

    @property({ attribute: false })
    accessor store: Account<Store>;

    @query("#validFrom")
    accessor validFrom: any;

    @query("#validTo")
    accessor validTo: any;

    onSubmit(e: CustomEvent) {
        // Dispatch on-create event
        this.dispatchEvent(
            new CustomEvent<CreateCouponDetail>("on-create", {
                bubbles: true,
                composed: true,
                detail: {
                    name: e.detail.name.toString(),
                    description: e.detail.description.toString(),
                    image: this.imageInput.file,
                    region: this.store.account.region,
                    geo: this.store.account.geo,
                    store: this.store,
                    validFrom: this.validFrom.valueAsDate,
                    validTo: this.validTo.valueAsDate,
                },
            })
        );

        // Close dialog
        this.dialog.hide();
    }

    protected async firstUpdated() {
        // Attach event to slotted button
        const button = this.buttonSlot.assignedNodes()[0];
        button.addEventListener("click", () => this.dialog.show());
    }

    static styles = css`
        sl-dialog::part(panel) {
            max-height: calc(85% - var(--sl-spacing-2x-large));
        }
        .date-container {
            display: flex;
            align-content: space-between;
            gap: 10px;
        }
        .date-range {
            flex: 1;
            width: 40%;
        }
    `;

    render() {
        // Default validity period
        const currentDate = new Date();
        const defaultValidTo = new Date();
        defaultValidTo.setMonth(currentDate.getMonth() + 6);

        return html`
            <!-- Button to trigger dialog -->
            <slot name="button"></slot>

            <sl-dialog label="Create Coupon" id="dialog">
                <form-event @on-submit=${this.onSubmit}>
                    <form action="submit" slot="form" id="createCouponForm">
                        <!-- Coupon Name -->
                        <sl-input
                            name="name"
                            label="Name"
                            required
                            maxlength=${COUPON_NAME_SIZE - STRING_PREFIX_SIZE}
                        ></sl-input>
                        <br />
                        <!-- Coupon Description -->
                        <sl-textarea
                            name="description"
                            label="Description"
                            maxlength=${200}
                            required
                        ></sl-textarea>
                        <br />
                        <!-- Coupon Category -->
                        <sl-select
                            label="Category"
                            clearable
                            required
                            value="other"
                        >
                            <sl-option value="food">Food</sl-option>
                            <sl-option value="events">Events</sl-option>
                            <sl-option value="retail">Retail</sl-option>
                            <sl-option value="other">Other</sl-option>
                        </sl-select>
                        <br />
                        <!-- Coupon Image -->
                        <label for="image-input">Coupon Image</label>
                        <image-input
                            label="150x150"
                            id="image-input"
                        ></image-input>
                        <br />
                        <!-- Coupon Validity Period -->
                        <div class="date-container">
                            <sl-input
                                id="validFrom"
                                name="validFrom"
                                class="date-range"
                                type="date"
                                label="Valid From"
                                .valueAsDate=${currentDate}
                                required
                            ></sl-input>
                            <sl-input
                                id="validTo"
                                name="validTo"
                                class="date-range"
                                type="date"
                                label="Valid To"
                                .valueAsDate=${defaultValidTo}
                                required
                            ></sl-input>
                        </div>
                        <sl-divider></sl-divider>
                        <!-- Store Information -->
                        <sl-input
                            label="Store"
                            name="store"
                            disabled
                            value=${this.store.account.name}
                        ></sl-input>
                    </form>
                </form-event>
                <sl-button
                    type="submit"
                    variant="primary"
                    slot="footer"
                    form="createCouponForm"
                    >Submit</sl-button
                >
            </sl-dialog>
        `;
    }
}

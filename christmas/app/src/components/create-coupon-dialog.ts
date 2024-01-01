import { LitElement, html, css } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { Account, Store } from "../../../lib/anchor-client/types";

export interface CreateCouponDetail {
    name: string;
    description: string;
    image: File | null;
    region: string;
    geo: string;
    store: Account<Store>;
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
        return html`
            <!-- Button to trigger dialog -->
            <slot name="button"></slot>

            <sl-dialog label="Create Coupon" id="dialog">
                <form-event @on-submit=${this.onSubmit}>
                    <form action="submit" slot="form" id="createCouponForm">
                        <!-- Coupon Name -->
                        <sl-input name="name" label="Name" required></sl-input>
                        <br />
                        <!-- Coupon Description -->
                        <sl-textarea
                            name="description"
                            label="Description"
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
                                name="validFrom"
                                class="date-range"
                                type="date"
                                label="Valid From"
                                placeholder="Valid From"
                            ></sl-input>
                            <sl-input
                                name="validTo"
                                class="date-range"
                                type="date"
                                label="Valid To"
                                placeholder="Valid To"
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

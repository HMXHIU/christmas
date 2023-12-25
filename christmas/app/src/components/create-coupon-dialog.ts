import { LitElement, html, css } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { COUNTRY_DETAILS } from "../lib/constants";
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
                    region: e.detail.region.toString(),
                    geo: e.detail.geo.toString(),
                    store: this.store,
                },
            })
        );

        // Close dialog
        this.dialog.hide();
    }

    protected firstUpdated() {
        const button = this.buttonSlot.assignedNodes()[0];
        button.addEventListener("click", () => this.dialog.show());
    }

    static styles = css`
        .date-container {
            display: flex;
            align-content: space-between;
            gap: 10px;
        }
        .date-range {
            flex: 1;
            width: 40%;
        }
        form {
            max-height: 500px;
        }
    `;

    render() {
        return html`
            <!-- Button to trigger dialog -->
            <slot name="button"></slot>

            <sl-dialog label="Create Coupon" id="dialog">
                <form-event @on-submit=${this.onSubmit}>
                    <form action="submit" slot="form">
                        <sl-input name="name" label="Name" required></sl-input>
                        <br />
                        <sl-textarea
                            name="description"
                            label="Description"
                            required
                        ></sl-textarea>
                        <br />
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
                        <sl-select
                            label="Region"
                            clearable
                            required
                            value=${this.store.account.region}
                            name="region"
                        >
                            ${Object.values(COUNTRY_DETAILS).map(
                                ([code, name]) =>
                                    html`<sl-option value="${code}"
                                        >${name}</sl-option
                                    >`
                            )}
                        </sl-select>
                        <br />

                        <sl-input
                            name="address"
                            label="Address/Location"
                        ></sl-input>
                        <br />

                        <label for="validity-period">Validity Period</label>
                        <div class="date-container" id="validity-period">
                            <sl-input
                                class="date-range"
                                type="date"
                                placeholder="Valid From"
                            ></sl-input>
                            <sl-input
                                class="date-range"
                                type="date"
                                placeholder="Valid To"
                            ></sl-input>
                        </div>
                        <br />

                        <image-input
                            label="Upload Image"
                            id="image-input"
                        ></image-input>
                        <br />

                        <sl-input
                            name="geo"
                            label="Geohash"
                            required
                            value="${this.store.account.geo}"
                        ></sl-input>
                        <br /><br />
                        <sl-button type="submit" variant="primary"
                            >Submit</sl-button
                        >
                        <br /><br />
                    </form>
                </form-event>
            </sl-dialog>
        `;
    }
}

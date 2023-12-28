import { LitElement, html, css } from "lit";
import { consume } from "@lit/context";
import { customElement, property, state, query } from "lit/decorators.js";
import { COUNTRY_DETAILS } from "../lib/constants";
import {
    locationContext,
    Location,
} from "../providers/userDeviceClientProvider";

export interface CreateStoreDetail {
    name: string;
    description: string;
    image: File | null;
    region: string;
    geo: string;
    address: string;
}

@customElement("create-store-dialog")
export class CreateStore extends LitElement {
    @query("#dialog")
    accessor dialog: any;

    @query('slot[name="button"]')
    accessor buttonSlot: any;

    @query("#image-input")
    accessor imageInput: any;

    @consume({ context: locationContext, subscribe: true })
    @state()
    accessor location: Location | null = null;

    onSubmit(e: CustomEvent) {
        // Dispatch on-create event
        this.dispatchEvent(
            new CustomEvent<CreateStoreDetail>("on-create", {
                bubbles: true,
                composed: true,
                detail: {
                    name: e.detail.name.toString(),
                    description: e.detail.description.toString(),
                    image: this.imageInput.file,
                    region: e.detail.region.toString(),
                    geo: e.detail.geo.toString(),
                    address: e.detail.address.toString(),
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
    `;

    render() {
        return html`
            <!-- Button to trigger dialog -->
            <slot name="button"></slot>
            <sl-dialog label="Create Store" id="dialog">
                <form-event @on-submit=${this.onSubmit}>
                    <form
                        class="input-validation-required"
                        action="submit"
                        slot="form"
                    >
                        <sl-input name="name" label="Name" required></sl-input>
                        <br />
                        <sl-textarea
                            name="description"
                            label="Description"
                            required
                        ></sl-textarea>
                        <br />

                        <br />
                        <sl-select
                            label="Region"
                            clearable
                            required
                            value=${this.location.country.code}
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

                        <location-search
                            name="address"
                            label="Address/Location"
                        ></location-search>
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
                            value="${this.location.geohash}"
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

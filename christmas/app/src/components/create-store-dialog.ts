import { LitElement, html, css } from "lit";
import { consume } from "@lit/context";
import { customElement, state, query } from "lit/decorators.js";
import { COUNTRY_DETAILS } from "../../../lib/user-device-client/defs";
import { Location } from "../../../lib/user-device-client/types";

import { locationContext } from "../providers/contexts";
import {
    STORE_NAME_SIZE,
    STRING_PREFIX_SIZE,
} from "../../../lib/anchor-client/def";

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

    @query("location-search")
    accessor locationSearch: any;

    @query('slot[name="button"]')
    accessor buttonSlot: any;

    @query("#image-input")
    accessor imageInput: any;

    @consume({ context: locationContext, subscribe: true })
    @state()
    accessor deviceLocation: Location | null = null; // default

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
                    geo: e.detail.geohash.toString(),
                    address: this.locationSearch.value, // `location-search` is not a form element
                },
            })
        );

        // Close dialog
        this.dialog.hide();
    }

    onLocationChange(e: CustomEvent<Location>) {
        this.location = e.detail || this.deviceLocation;
    }

    protected firstUpdated() {
        const button = this.buttonSlot.assignedNodes()[0];
        button.addEventListener("click", () => this.dialog.show());
    }

    static styles = css`
        .container-lat-lng {
            display: flex;
            gap: 10px;
        }

        sl-dialog::part(panel) {
            max-height: calc(85% - var(--sl-spacing-2x-large));
        }

        sl-input[name="geohash"] {
            display: none;
        }
    `;

    render() {
        return html`
            <!-- Button to trigger dialog -->
            <slot name="button"></slot>

            <!-- Dialog -->
            <sl-dialog label="Create Store" id="dialog">
                <form-event @on-submit=${this.onSubmit}>
                    <form
                        class="input-validation-required"
                        action="submit"
                        slot="form"
                        id="createStoreForm"
                    >
                        <!-- Store name -->
                        <sl-input
                            name="name"
                            label="Store Name"
                            maxlength=${STORE_NAME_SIZE - STRING_PREFIX_SIZE}
                            required
                        ></sl-input>
                        <br />

                        <!-- Store description -->
                        <sl-textarea
                            name="description"
                            label="Store Description"
                            maxlength=${400}
                            required
                        ></sl-textarea>
                        <br />

                        <!-- Store logo -->
                        <label for="image-input">Store Logo</label>
                        <image-input
                            label="150x150"
                            id="image-input"
                        ></image-input>
                        <sl-divider></sl-divider>

                        <!-- Address -->
                        <location-search
                            name="address"
                            required
                            label="Store Address"
                            help-text="Locate your store's address. Alternatively, you may manually enter the location details (coutry, latitude, longitude) below."
                            @on-location-change=${this.onLocationChange}
                        ></location-search>
                        <br />
                        <!-- Country -->
                        <sl-select
                            label="Country"
                            clearable
                            required
                            value=${this.location?.country?.code ||
                            this.deviceLocation.country.code}
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

                        <div class="container-lat-lng">
                            <!-- Latitude -->
                            <sl-input
                                name="latitude"
                                label="Latitude"
                                required
                                value="${this.location?.geolocationCoordinates
                                    ?.latitude ||
                                this.deviceLocation.geolocationCoordinates
                                    ?.latitude}"
                            ></sl-input>
                            <!-- Longitude -->
                            <sl-input
                                name="longitude"
                                label="Longitude"
                                required
                                value="${this.location?.geolocationCoordinates
                                    ?.longitude ||
                                this.deviceLocation.geolocationCoordinates
                                    ?.longitude}"
                            ></sl-input>
                            <!-- Geohash -->
                            <sl-input
                                name="geohash"
                                label="Geohash"
                                required
                                value="${this.location?.geohash ||
                                this.deviceLocation.geohash}"
                            ></sl-input>
                        </div>
                    </form>
                </form-event>
                <!-- Create Store -->
                <sl-button
                    type="submit"
                    variant="primary"
                    slot="footer"
                    form="createStoreForm"
                >
                    Create Store
                </sl-button>
            </sl-dialog>
        `;
    }
}

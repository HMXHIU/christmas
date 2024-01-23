import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import geohash from "ngeohash";

import { COUNTRY_DETAILS } from "../../../lib/user-device-client/defs";
import { Location } from "../../../lib/user-device-client/types";

@customElement("location-search")
export class LocationSearch extends LitElement {
    @property({ attribute: true, type: String })
    accessor label: string = "";

    @property({ attribute: true, type: String })
    accessor value: string = "";

    @property({ attribute: "help-text", type: String })
    accessor helpText: string = "";

    @property({ reflect: true, type: Boolean })
    accessor required: boolean = false;

    protected firstUpdated() {
        setTimeout(() => {
            // Initialize search box on input element (Note: `sl-input` shadowRoot is not rendered yet, thus the delay)
            const input = this.shadowRoot
                .querySelector("sl-input")
                .renderRoot.querySelector("input");
            const searchBox = new google.maps.places.SearchBox(input);

            // Dispatch `on-location-change`
            searchBox.addListener("places_changed", () => {
                const places = searchBox.getPlaces();

                if (places.length == 0) {
                    return;
                }

                let countryCode = null;
                let countryName = null;
                const lat = places[0].geometry.location.lat();
                const lng = places[0].geometry.location.lng();

                // set `value` for parent form
                this.value = places[0]["formatted_address"];

                for (const component of places[0]["address_components"]) {
                    if (component.types.includes("country")) {
                        [countryCode, countryName] =
                            COUNTRY_DETAILS[component.short_name];
                        break;
                    }
                }

                // Dispatch on-location-change event
                this.dispatchEvent(
                    new CustomEvent<Location>("on-location-change", {
                        bubbles: true,
                        composed: true,
                        detail: {
                            geohash: geohash.encode(lat, lng, 6),
                            geolocationCoordinates: {
                                latitude: lat,
                                longitude: lng,
                                accuracy: null,
                                altitude: null,
                                altitudeAccuracy: null,
                                heading: null,
                                speed: null,
                            },
                            country: {
                                code: countryCode,
                                name: countryName,
                            },
                        },
                    })
                );
            });
        }, 200);
    }

    render() {
        return html`
            <sl-input
                label=${this.label}
                help-text=${this.helpText}
                ?required=${this.required}
            ></sl-input>
        `;
    }
}

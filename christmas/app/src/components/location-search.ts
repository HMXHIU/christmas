import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("location-search")
export class LocationSearch extends LitElement {
    protected firstUpdated() {
        // `sl-input` shadowRoot is not rendered yet
        setTimeout(() => {
            const input = this.shadowRoot
                .querySelector("sl-input")
                .renderRoot.querySelector("input");
            // Initialize search box on input element
            new google.maps.places.SearchBox(input);
        }, 200);
    }

    render() {
        return html` <sl-input></sl-input> `;
    }
}

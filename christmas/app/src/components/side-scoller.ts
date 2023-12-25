import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("side-scoller")
export class SideScroller extends LitElement {
    static styles = css`
        .container {
            overflow-x: auto;
            white-space: nowrap;
            display: flex;
            padding: 10px;
        }
        /* Style the slotted items */
        ::slotted(*) {
            flex: 0 0 auto;
            padding: 10px;
            margin-right: 10px; /* Adjust the margin as needed */
        }
    `;

    render() {
        return html`
            <div class="container">
                <slot></slot>
            </div>
        `;
    }
}

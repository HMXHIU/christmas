import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("loading-page")
export class LoadingPage extends LitElement {
    static styles = css`
        .loader {
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            sl-spinner {
                font-size: 3rem;
                --indicator-color: deeppink;
                --track-color: pink;
            }
        }
    `;

    render() {
        return html`
            <div class="loader">
                <sl-spinner> </sl-spinner>
            </div>
        `;
    }
}

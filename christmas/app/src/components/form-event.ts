import { LitElement, html } from "lit";
import { customElement, query } from "lit/decorators.js";

@customElement("form-event")
export class FormEvent extends LitElement {
    @query('slot[name="form"]')
    accessor form: any;

    protected firstUpdated() {
        this.addEventListener("submit", (e) => {
            e.preventDefault();
            const formElement = this.form.assignedNodes()[0];

            let entries = new Array();
            new FormData(formElement).forEach((value, key) => {
                entries.push([key, value]);
            });

            // Dispatch on-submit event
            this.dispatchEvent(
                new CustomEvent("on-submit", {
                    bubbles: true,
                    composed: true,
                    detail: Object.fromEntries(entries),
                })
            );
        });
    }

    render() {
        return html`
            <div>
                <slot name="form"></slot>
            </div>
        `;
    }
}

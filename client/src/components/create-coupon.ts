import { LitElement, html, css } from "lit";
import { customElement, property, state, query } from "lit/decorators.js";
import { COUNTRY_DETAILS } from "../lib/constants";

@customElement("create-coupon")
export class CreateCoupon extends LitElement {
  @query("#dialog")
  accessor dialog: any;

  @query("#dialog-close")
  accessor dialogClose: any;

  @query("#dialog-open")
  accessor dialogOpen: any;

  @property({ attribute: true, type: String })
  accessor defaultRegion: string = "";

  @property({ attribute: true, type: String })
  accessor defaultGeohash: string = "";

  firstUpdated() {
    this.dialogClose.addEventListener("click", () => this.dialog.hide());
    this.dialogOpen.addEventListener("click", () => this.dialog.show());
  }

  render() {
    return html`
      <sl-button id="dialog-open">Create Coupon</sl-button>
      <sl-dialog label="Create Coupon" id="dialog">
        <form class="input-validation-required">
          <sl-input name="name" label="Name" required></sl-input>
          <br />
          <sl-textarea
            name="description"
            label="Description"
            required
          ></sl-textarea>
          <br />
          <sl-select label="Category" clearable required value="other">
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
            value=${this.defaultRegion}
          >
            ${Object.values(COUNTRY_DETAILS).map(
              ([code, name]) =>
                html`<sl-option value="${code}">${name}</sl-option>`
            )}
          </sl-select>
          <br />

          <image-input label="Upload Image"></image-input>
          <br />

          <sl-input
            name="geohash"
            label="Geohash"
            required
            value="${this.defaultGeohash}"
          ></sl-input>
          <br /><br />
          <sl-button type="submit" variant="primary">Submit</sl-button>
          <sl-button variant="primary" id="dialog-close">Close</sl-button>
        </form>
      </sl-dialog>
    `;
  }
}

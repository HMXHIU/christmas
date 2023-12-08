import { LitElement, html, css } from "lit";
import { customElement, property, state, query } from "lit/decorators.js";
import { Coupon, CouponMetadata } from "../lib/anchor/anchorClient";
import { cleanString } from "../lib/anchor/utils";

@customElement("mint-coupon-dialog")
export class MintCoupon extends LitElement {
  @query("#dialog")
  accessor dialog: any;

  @query("#dialog-close")
  accessor dialogClose: any;

  @query("#dialog-open")
  accessor dialogOpen: any;

  @query("#form-submit")
  accessor form: any;

  @property({ attribute: true, type: Number })
  accessor supply!: number;

  @property({ attribute: true, type: Number })
  accessor balance!: number;

  @property({ attribute: false })
  accessor coupon!: Coupon;

  @property({ attribute: false })
  accessor couponMetadata: CouponMetadata = {
    name: "",
    description: "",
    image: "",
  };

  firstUpdated() {
    // Dialog events
    this.dialogClose.addEventListener("click", () => this.dialog.hide());
    this.dialogOpen.addEventListener("click", () => this.dialog.show());

    // Form events
    this.form.addEventListener("submit", (e: FormDataEvent) => {
      e.preventDefault(); // prevent refresh browser
      new FormData(this.form); // construct a FormData object, which fires the formdata event
    });
    this.form.addEventListener("formdata", (e: FormDataEvent) => {
      const parsed = Object.fromEntries(Array.from(e.formData.entries()));

      console.log(parsed);

      // // Dispatch on-create event
      // this.dispatchEvent(
      //   new CustomEvent<CreateCouponDetail>("on-create", {
      //     bubbles: true,
      //     composed: true,
      //     detail: {
      //       name: parsed.name.toString(),
      //       description: parsed.description.toString(),
      //       image: this.imageInput.file,
      //       region: parsed.region.toString(),
      //       geo: parsed.geo.toString(),
      //     },
      //   })
      // );
    });
  }

  static styles = css``;

  render() {
    return html`
      <sl-button variant="success" outline id="dialog-open"> Mint </sl-button>
      <sl-dialog
        label="Mint ${cleanString(this.coupon.account.name)}"
        id="dialog"
      >
        <form class="input-validation-required" id="form-submit">
          <sl-textarea name="description" label="Description" disabled>
            ${this.couponMetadata.description}
          </sl-textarea>
          <br />
          <sl-input
            name="numTokens"
            type="number"
            label="Number of Coupons"
            min=${1}
            required
            help-text="${this.balance} left out of ${this.supply}"
          ></sl-input>
          <br /><br />
          <sl-button type="submit" variant="primary">Submit</sl-button>
          <sl-button variant="primary" id="dialog-close">Close</sl-button>
        </form>
      </sl-dialog>
    `;
  }
}

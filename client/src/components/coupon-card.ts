import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Coupon } from "../lib/anchor/anchorClient";

@customElement("coupon-card")
export class CouponCard extends LitElement {
  @property({ attribute: false })
  accessor coupon: Coupon;

  static styles = css`
    .card-overview {
      max-width: 300px;
    }

    .card-overview small {
      color: var(--sl-color-neutral-500);
    }

    .card-overview [slot="footer"] {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  `;

  render() {
    return html`
      <sl-card class="card-overview">
        <img
          slot="image"
          src="https://images.unsplash.com/photo-1559209172-0ff8f6d49ff7?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=500&q=80"
        />

        <strong>Mittens</strong><br />
        This kitten is as cute as he is playful. Bring him home today!<br />
        <small>6 weeks old</small>

        <div slot="footer">
          <sl-button variant="primary" pill>More Info</sl-button>
          <sl-rating></sl-rating>
        </div>
      </sl-card>
    `;
  }
}

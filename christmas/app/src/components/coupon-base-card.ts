import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { cleanString } from "../../../lib/anchor-client/utils";

@customElement("coupon-base-card")
export class CouponCard extends LitElement {
    @property({ attribute: true, type: Number })
    accessor distance: number;

    @property({ attribute: true, type: String })
    accessor couponImageUrl: string;

    @property({ attribute: true, type: String })
    accessor couponName: string;

    @property({ attribute: true, type: Number })
    accessor remaining: number;

    @property({ attribute: true, type: String })
    accessor storeImageUrl: string;

    @property({ attribute: true, type: String })
    accessor storeName: string;

    @property({ attribute: true, type: String })
    accessor storeAddress: string;

    @property({ attribute: false })
    accessor expiry: Date;

    static styles = css`
        :host {
            display: block;
            margin: 10px 0px 0px 10px;
        }
        sl-card::part(base) {
            width: var(--coupon-card-width);
            height: var(--coupon-card-height);
            margin: 0px;
        }
        sl-card::part(body),
        sl-card::part(footer) {
            padding-top: 5px;
            padding-bottom: 5px;
            padding-left: 10px;
            padding-right: 10px;
        }
        sl-card [slot="footer"] {
            display: flex;
            justify-content: start;
            align-items: center;
        }
        sl-card small {
            color: var(--sl-color-neutral-500);
        }
        .coupon-image,
        .empty-image {
            height: var(--coupon-card-image-height);
            max-height: 100%;
            object-fit: contain; /* Maintain aspect ratio and fill container */
            object-position: top;
        }
        .empty-image {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            sl-icon {
                flex: 1;
            }
        }
        .coupon-name {
            font-size: var(--sl-font-size-medium);
            font-weight: var(--sl-font-weight-semibold);
        }
        .coupon-expiry {
            font-size: var(--sl-font-size-x-small);
            font-style: italic;
            font-weight: var(--sl-font-weight-light);
            color: var(--sl-color-neutral-500);
            margin-bottom: 5px;
            margin-top: 5px;
        }
        .coupon-remaining {
            font-size: var(--sl-font-size-x-small);
            font-weight: var(--sl-font-weight-light);
            color: var(--sl-color-neutral-500);
            margin-bottom: 5px;
            margin-top: 5px;
        }
        .store-image {
            height: 60px;
            width: 60px;
        }
        .store-details {
            display: flex;
            flex-direction: column;
            padding-left: 10px;
            max-width: 100%;
            overflow: hidden;
        }
        .store-name {
            font-size: var(--sl-font-size-small);
            margin: 0px;
            padding: 0px 0px 5px 0px;
        }
        .store-address {
            font-size: var(--sl-font-size-x-small);
            font-weight: var(--sl-font-weight-light);
            color: var(--sl-color-neutral-500);
            margin: 0px;
            padding: 0px 0px 5px 0px;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }
        .store-distance {
            font-size: var(--sl-font-size-x-small);
            font-weight: var(--sl-font-weight-light);
            font-style: italic;
            color: var(--sl-color-success-500);
            margin: 0px;
            padding: 0px;
        }
    `;

    getDistance() {
        if (this.distance) {
            if (this.distance < 0.1) {
                return html` <p class="store-distance">nearby</p> `;
            } else if (this.distance < 1) {
                return html`
                    <p class="store-distance">
                        ${Math.trunc(this.distance * 1000)}m
                    </p>
                `;
            }
            return html`
                <p class="store-distance">${Math.round(this.distance)}km</p>
            `;
        }
        return html``;
    }

    getRemaining() {
        if (this.remaining != null) {
            return html`<p class="coupon-remaining">
                ${this.remaining} remaining
            </p>`;
        }
        return html``;
    }

    render() {
        return html`
            <sl-card class="card-overview" slot="click-to-open" part="base">
                <!-- Image -->
                ${this.couponImageUrl
                    ? html`<img
                          class="coupon-image"
                          slot="image"
                          src="${this.couponImageUrl}"
                      />`
                    : html`
                          <div class="empty-image" slot="image">
                              <sl-icon name="image-fill"></sl-icon>
                          </div>
                      `}
                <!-- Coupon Name -->
                <p class="coupon-name">${cleanString(this.couponName)}</p>
                <!-- Expiry -->
                <p class="coupon-expiry">
                    Expires
                    <sl-format-date
                        month="long"
                        day="numeric"
                        year="numeric"
                        .date=${this.expiry}
                    ></sl-format-date>
                </p>
                ${this.getRemaining()}
                <!-- Store Info -->
                <div slot="footer">
                    <sl-avatar
                        image=${this.storeImageUrl}
                        label=${this.storeName}
                    ></sl-avatar>
                    <div class="store-details">
                        <p class="store-name">${this.storeName}</p>
                        <p class="store-address">${this.storeAddress}</p>
                        ${this.getDistance()}
                    </div>
                </div>
            </sl-card>
        `;
    }
}

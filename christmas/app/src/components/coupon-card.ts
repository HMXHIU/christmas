import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
    Coupon,
    CouponMetadata,
    Account,
    TokenAccount,
    StoreMetadata,
    Store,
} from "../../../lib/anchor-client/types";
import { getCouponMetadata, getStoreMetadata } from "../lib/utils";
import { cleanString } from "../../../lib/anchor-client/utils";
import { ParsedAccountData } from "@solana/web3.js";
import { anchorClientContext } from "../providers/contexts";
import { consume } from "@lit/context";
import { AnchorClient } from "../../../lib/anchor-client/anchorClient";

@customElement("coupon-card")
export class CouponCard extends LitElement {
    @consume({ context: anchorClientContext, subscribe: true })
    @state()
    accessor anchorClient: AnchorClient | null = null;

    @property({ attribute: false })
    accessor coupon!: Account<Coupon>;

    @property({ attribute: false })
    accessor tokenAccount!: TokenAccount;

    @state()
    accessor couponMetadata: CouponMetadata = {
        name: "",
        description: "",
        image: "",
    };

    @state()
    accessor storeMetadata: StoreMetadata;

    @state()
    accessor store: Store;

    async fetchStoreMetadata() {
        this.store = await this.anchorClient.getStoreByPda(
            this.coupon.account.store
        );
        this.storeMetadata = await getStoreMetadata(this.store);
    }
    async fetchCouponMetadata() {
        this.couponMetadata = await getCouponMetadata(this.coupon.account);
    }

    async willUpdate(changedProperties: PropertyValues<this>) {
        if (changedProperties.has("anchorClient")) {
            if (this.anchorClient) {
                await this.fetchCouponMetadata();
                await this.fetchStoreMetadata();
            }
        }
    }

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
            padding-top: 0px;
            padding-bottom: 0px;
            padding-left: 10px;
            padding-right: 10px;
        }
        sl-card [slot="footer"] {
            display: flex;
            justify-content: space-between;
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
        .store-name {
            font-size: var(--sl-font-size-medium);
        }
        .store-address {
            font-size: var(--sl-font-size-medium);
        }
    `;

    render() {
        const tokenAccountData = (
            this.tokenAccount.account.data as ParsedAccountData
        ).parsed.info;

        return html`
            <claim-coupon-dialog
                .coupon=${this.coupon}
                .couponMetadata=${this.couponMetadata}
            >
                <sl-card
                    class="card-overview"
                    slot="click-to-open"
                    part="card-overview"
                >
                    <!-- Image -->
                    ${this.couponMetadata.image
                        ? html`<img
                              class="coupon-image"
                              slot="image"
                              src="${this.couponMetadata.image}"
                          />`
                        : html`
                              <div class="empty-image" slot="image">
                                  <sl-icon name="image-fill"></sl-icon>
                              </div>
                          `}
                    <!-- Coupon Name -->
                    <p class="coupon-name">
                        ${cleanString(this.coupon.account.name)}
                    </p>
                    <!-- Expiry -->
                    <p class="coupon-expiry">
                        Expires
                        <sl-format-date
                            month="long"
                            day="numeric"
                            year="numeric"
                            >${this.coupon.account.validTo}</sl-format-date
                        >
                    </p>
                    <p class="coupon-remaining">
                        ${tokenAccountData.tokenAmount.uiAmount} remaining
                    </p>
                    <!-- Store Info -->
                    <div slot="footer">
                        <p class="store-name">${this.storeMetadata?.name}</p>
                    </div>
                </sl-card>
            </claim-coupon-dialog>
        `;
    }
}

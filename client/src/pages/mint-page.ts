import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { ClientDevice } from "../lib/utils";
import { consume } from "@lit/context";
import { AnchorClient } from "../lib/anchor/anchorClient";
import { anchorClientContext, clientDeviceContext } from "../layouts/app-main";

@customElement("app-mint")
export class AppMint extends LitElement {
  @consume({ context: clientDeviceContext })
  @state()
  accessor clientDevice: ClientDevice | null = null;

  @consume({ context: anchorClientContext })
  @state()
  accessor anchorClient: AnchorClient | null = null;

  @state()
  accessor defaultRegion: string = "";

  @state()
  accessor defaultGeohash: string = "";

  async firstUpdated() {
    this.defaultRegion = this.clientDevice?.country?.code || "";
    this.defaultGeohash = this.clientDevice?.geohash || "";
  }

  render() {
    return html`
      <div>Mint Page</div>
      <create-coupon
        defaultRegion="${this.defaultRegion}"
        defaultGeohash="${this.defaultGeohash}"
      ></create-coupon>
    `;
  }
}

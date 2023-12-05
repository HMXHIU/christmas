import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("solana-wallet")
export class SolanaWallet extends LitElement {
  @property()
  version: string = "STARTING";

  render() {
    return html`
      <p>Welcome to the Lit tutorial!</p>
      <p>This is the ${this.version} code.</p>
    `;
  }
}

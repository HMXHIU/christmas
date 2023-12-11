import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("app-footer")
export class AppFooter extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    .bottom-nav {
      overflow: hidden;
      position: fixed;
      left: 0;
      bottom: 0;
      width: 100%;
      text-align: center;
    }
    .bottom-nav ::slotted(*) {
      float: left;
      text-align: center;
      padding: 14px 16px;
      text-decoration: none;
      font-size: 17px;
    }
  `;

  render() {
    return html`
      <div part="bottom-nav" class="bottom-nav">
        <slot name="left"></slot>
        <slot name="center"></slot>
        <slot name="right"></slot>
      </div>
    `;
  }
}

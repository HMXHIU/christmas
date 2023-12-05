import {
  LitElement,
  html,
} from "https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js";

class MyElement extends LitElement {
  render() {
    return html` <div>Hello from MyElement!</div> `;
  }
}
customElements.define("my-element", MyElement);

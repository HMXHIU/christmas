import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

@customElement("image-input")
export class ImageInput extends LitElement {
  static styles = css`
    input {
      margin-top: 10px;
      margin-bottom: 20px;
    }
    img {
      max-width: 100%; /* Ensure the image does not exceed its parent's width */
      height: auto; /* Maintain the image's aspect ratio */
      display: block; /* Remove any extra spacing below the image */
    }
  `;

  @property({ attribute: true, type: String })
  accessor label: string = "";

  @state()
  accessor image: string = "";

  onChangeImage(e: Event) {
    const inputElement = e.target as HTMLInputElement;
    const file = inputElement.files?.[0];

    if (file) {
      // Set image preview
      const reader = new FileReader();
      reader.onloadend = () => {
        this.image = reader.result as string;
      };
      reader.readAsDataURL(file);

      // Dispatch upload event
      this.dispatchEvent(
        new CustomEvent("on-upload", {
          detail: { file },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  render() {
    return html`
      <label for="image">${this.label}</label>
      <br />
      <input
        type="file"
        id="image"
        name="image"
        accept="image/*"
        @change="${this.onChangeImage}"
      />
      ${this.image ? html` <img src="${this.image}" /> ` : null}
    `;
  }
}

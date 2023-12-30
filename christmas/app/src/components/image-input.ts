import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

@customElement("image-input")
export class ImageInput extends LitElement {
    static styles = css`
        img {
            max-width: 100%;
            max-height: 100%;
            width: auto;
            height: auto;
            display: block;
            position: absolute;
            border-radius: 10px;
            pointer-events: none; /* Allow clicks to pass through the image */
            object-fit: contain; /* Adjust this property as needed (e.g., contain) */
        }

        /* Hide the default file input */
        input[type="file"] {
            display: none;
        }

        /* Add the button styles */
        .input-box {
            position: relative; /* Make sure the image is positioned relative to the button */
            margin: 4px;
            width: 150px;
            height: 150px;
            border: 2px dashed #3498db;
            border-radius: 10px;
            background-color: transparent;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            overflow: hidden; /* Hide any content that overflows the button */
            transition: background-color 0.3s ease;
        }

        .input-box:hover {
            background-color: rgba(52, 152, 219, 0.2);
        }
    `;

    @property({ attribute: true, type: String })
    accessor label: string = "";

    @property({ attribute: false })
    accessor file: File | null = null;

    @state()
    accessor image: string = "";

    onChangeImage(e: Event) {
        const inputElement = e.target as HTMLInputElement;
        const file = inputElement.files?.[0];

        if (file) {
            // Set file
            this.file = file;

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

    onButtonClick() {
        // Trigger the hidden file input
        const fileInput = this.shadowRoot?.getElementById(
            "image"
        ) as HTMLInputElement;
        fileInput?.click();
    }

    render() {
        return html`
            <button class="input-box" @click="${this.onButtonClick}">
                ${this.label}
                ${this.image ? html` <img src="${this.image}" /> ` : null}
                <input
                    type="file"
                    id="image"
                    name="image"
                    accept="image/*"
                    @change="${this.onChangeImage}"
                />
            </button>
        `;
    }
}

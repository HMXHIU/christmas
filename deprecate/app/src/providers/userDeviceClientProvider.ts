import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { provide } from "@lit/context";
import { Location } from "../../../lib/user-device-client/types";
import { UserDeviceClient } from "../../../lib/user-device-client/userDeviceClient";
import { locationContext } from "./contexts";

@customElement("user-device-client-provider")
export class UserDeviceClientProvider extends LitElement {
    @provide({ context: locationContext })
    @state()
    accessor location: Location | null = null;

    async firstUpdated() {
        // Initialize userDeviceClient
        const userDeviceClient = new UserDeviceClient();
        await userDeviceClient.initialize();

        // Set contexts
        this.location = userDeviceClient.location;
    }

    render() {
        return html`<slot></slot>`;
    }
}

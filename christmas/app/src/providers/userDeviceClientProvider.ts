import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { provide } from "@lit/context";
import { createContext } from "@lit/context";
import { Location } from "../../../lib/user-device-client/utils";
import { UserDeviceClient } from "../../../lib/user-device-client/userDeviceClient";

export { Location };

export const locationContext = createContext<Location | null>(
    Symbol("user-device-client")
);

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

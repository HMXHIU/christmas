import { getLocation } from "./utils";
import type { Location } from "./types";

export class UserDeviceClient {
    location: Location | null;
    isInitialized: Boolean;

    constructor() {
        this.isInitialized = false;
        this.location = null;
    }

    async initialize() {
        this.location = await getLocation();
        this.isInitialized = true;

        // log location for debug
        console.log(JSON.stringify(this.location, null, 2));
    }
}

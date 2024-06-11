import type { Location } from "./types";
import { getLocation } from "./utils";

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
    }
}

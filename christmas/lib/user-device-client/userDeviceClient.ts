import { getLocation } from "./utils";
import { Location } from "./types";

export class UserDeviceClient {
    location: Location;
    isInitialized: Boolean;

    constructor() {
        this.isInitialized = false;
    }

    async initialize() {
        this.location = await getLocation();
        this.isInitialized = true;
    }
}

import bs58 from "bs58";
import { z } from "zod";

export {
    AsyncLock,
    calculateDistance,
    divmod,
    extractQueryParams,
    generateURL,
    getCurrentTimestamp,
    getErrorMessage,
    imageDataUrlToFile,
    imageUrlToDataURL,
    isBrowser,
    parseZodErrors,
    retry,
    sleep,
    stringToBase58,
    stringToUint8Array,
    substituteValues,
    substituteVariables,
    substituteVariablesRecursively,
};

function substituteValues(
    d: Record<string, string>,
    variables: Record<string, any>,
) {
    const result: Record<string, string> = {};
    for (const key in d) {
        if (d.hasOwnProperty(key)) {
            result[key] = substituteVariables(d[key], variables);
        }
    }
    return result;
}

/**
 * {{variable access}} only works when the string begins with {{ and ends with }}
 */
function substituteVariables(template: string, variables: Record<string, any>) {
    // TODO: replace with lodash get
    function getValueFromPath(obj: any, path: string): any {
        return path
            .split(/\.|\[|\]/g)
            .filter(Boolean) // Remove any empty strings from the array
            .reduce((acc, key) => acc && acc[key], obj);
    }

    // Variable access eg. {{target.loc}} or {{points[0]}}, returns the variable directly (vs string)
    if (template.startsWith("{{") && template.endsWith("}}")) {
        const path = template.replace(/{{(.*?)}}/g, "$1").trim();
        return getValueFromPath(variables, path);
    }

    // String substitution eg. ${description} or ${points[0]}
    return template.replace(/\${(.*?)}/g, (match, v) => {
        const path = v.trim();
        const value = getValueFromPath(variables, path);
        return value !== undefined ? String(value) : match;
    });
}

function substituteVariablesRecursively(
    obj: any,
    variables: Record<string, any>,
): any {
    // Handle primitives and null
    if (obj === null || typeof obj !== "object") {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map((item) =>
            substituteVariablesRecursively(item, variables),
        );
    }

    // Handle objects
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "string") {
            result[key] = substituteVariables(value, variables);
        } else {
            result[key] = substituteVariablesRecursively(value, variables);
        }
    }

    return result;
}

function stringToBase58(str: string) {
    return bs58.encode(Buffer.from(str));
}

function stringToUint8Array(input: string): Uint8Array {
    return new TextEncoder().encode(input);
}

function getCurrentTimestamp(date: Date): string {
    const timestamp = (date || new Date()).toLocaleString("en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
    });
    return timestamp; // somehow need to store it in a variable (directly returning is undefined)
}

function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
): number {
    const R = 6371; // Earth's radius in kilometers

    // Convert latitudes from degrees to radians
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;

    const lon1Rad = (lon1 * Math.PI) / 180;
    const lon2Rad = (lon2 * Math.PI) / 180;

    const x = (lon2Rad - lon1Rad) * Math.cos((lat1Rad + lat2Rad) / 2);
    const y = lat2Rad - lat1Rad;

    // Distance using Equirectangular approximation
    const distance = Math.sqrt(x * x + y * y) * R;

    return distance;
}

function getErrorMessage(error: any): string {
    // Parse error if its a JSON string
    try {
        error = JSON.parse(error);
    } catch (e) {}

    // Drill down to find message string
    if (error.message) {
        if (typeof error.message === "string") {
            return error.message;
        } else if (typeof error.message.message === "string") {
            return error.message.message;
        }
    } else if (typeof error === "string") {
        return error;
    }
    // parse error to string
    return JSON.stringify(error);
}

function generateURL(kwargs: Record<string, string>, uri?: string) {
    const origin =
        (typeof window !== "undefined" ? window.location.origin : undefined) ||
        "https://${origin}";

    const queryParams = new URLSearchParams();

    for (const key in kwargs) {
        if (kwargs.hasOwnProperty(key)) {
            queryParams.append(key, kwargs[key]);
        }
    }

    const url = uri ? new URL(uri, origin) : new URL(origin);
    queryParams.sort();
    url.search = queryParams.toString();

    return url.toString();
}

function extractQueryParams(url: string): Record<string, string> {
    return Object.fromEntries(new URL(url).searchParams.entries());
}

async function imageDataUrlToFile(
    imageDataUrl: string,
): Promise<{ mimeType: string; file: File }> {
    // Split the data URL to extract MIME type and base64 data
    const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
        throw new Error("Invalid Image Data URL");
    }
    const [, mimeType, base64Data] = match;

    // Convert base64 to binary
    const binaryData = atob(base64Data);
    const dataArray = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
        dataArray[i] = binaryData.charCodeAt(i);
    }

    // Create Blob from binary data
    const blob = new Blob([dataArray], { type: mimeType });

    // Create File from Blob
    const file = new File([blob], `image.${mimeType.split("/")[1]}`, {
        type: mimeType,
    });

    return { mimeType, file };
}

async function imageUrlToDataURL(url: string): Promise<string> {
    const response = await fetch(url);
    const blob = await response.blob();

    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === "string") {
                resolve(reader.result);
            } else {
                reject(new Error("Failed to convert image to data URL."));
            }
        };
        reader.onerror = () => {
            reject(new Error("Failed to read the image."));
        };
        reader.readAsDataURL(blob);
    });
}

function parseZodErrors(err: any): Record<string, string> {
    let errors: Record<string, string> = {};
    if (err instanceof z.ZodError) {
        for (const { path, message } of err.issues) {
            errors[path[0]] = message;
        }
    }
    return errors;
}

/**
 * Retries the provided asynchronous function with a specified number of attempts and delay between each attempt.
 * If an error occurs during any attempt, it will retry the function until the maximum number of attempts is reached.
 * An optional remedy function can be provided to perform a specific action before the second attempt.
 *
 * @param fn - The asynchronous function to retry.
 * @param maxAttempts - The maximum number of attempts to make.
 * @param delay - The delay in milliseconds between each attempt.
 * @param remedyFn - An optional function to perform a specific action before the second attempt.
 * @returns A promise that resolves to the result of the successful attempt.
 * @throws If the maximum number of attempts is reached without a successful attempt.
 */
async function retry<T>({
    fn,
    maxAttempts,
    delay,
    remedyFn,
}: {
    fn: () => Promise<T>;
    maxAttempts?: number;
    delay?: number;
    remedyFn?: () => Promise<void>;
}): Promise<T> {
    maxAttempts = maxAttempts ?? 2;
    delay = delay ?? 100;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === maxAttempts) {
                throw new Error("Max retry attempts.");
            }
            if (remedyFn && attempt === 0) {
                console.log("Retrying with remedy function...");
                await remedyFn();
            }
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    throw new Error("Max retry attempts.");
}

async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

class AsyncLock {
    private locked: boolean = false;
    private waitingQueue: (() => void)[] = [];

    async acquire(): Promise<void> {
        if (!this.locked) {
            this.locked = true;
            return;
        }

        return new Promise<void>((resolve) => {
            this.waitingQueue.push(resolve);
        });
    }

    release(): void {
        if (this.waitingQueue.length > 0) {
            const nextResolve = this.waitingQueue.shift();
            nextResolve?.();
        } else {
            this.locked = false;
        }
    }

    async withLock<T>(fn: () => Promise<T>): Promise<T> {
        await this.acquire();
        try {
            return await fn();
        } finally {
            this.release();
        }
    }
}

function divmod(n: number, d: number): [number, number] {
    return [Math.floor(n / d), n % d];
}

function isBrowser(): boolean {
    return typeof window !== "undefined";
}

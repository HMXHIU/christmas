export function stringToUint8Array(input: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(input);
}

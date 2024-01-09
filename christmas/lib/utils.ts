import { BN } from "@coral-xyz/anchor";

export function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371; // Earth's radius in kilometers

    // Convert latitudes from degrees to radians
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;

    const x = (lon2 - lon1) * Math.cos((lat1Rad + lat2Rad) / 2);
    const y = lat2Rad - lat1Rad;

    // Distance using Equirectangular approximation
    const distance = Math.sqrt(x * x + y * y) * R;

    return distance;
}

export function timeStampToDate(timeStamp: BN): Date {
    return new Date(timeStamp.toNumber());
}

export function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371; // Earth's radius in kilometers

    const x = (lon2 - lon1) * Math.cos((lat1 + lat2) / 2);
    const y = lat2 - lat1;

    // Distance using Equirectangular approximation
    const distance = Math.sqrt(x * x + y * y) * R;

    return distance;
}

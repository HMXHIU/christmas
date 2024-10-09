export {
    generatePin,
    generateRandomSeed,
    sampleFrom,
    seededRandom,
    seededRandomNumberBetween,
    stringToRandomNumber,
};

/**
 * Converts a string to a random number.
 *
 * @param str - The string to convert.
 * @returns The random number generated from the string (seed).
 */
function stringToRandomNumber(str: string): number {
    var hash = 0;
    if (str.length === 0) return hash;
    for (var i = 0; i < str.length; i++) {
        var char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char; // Bitwise left shift and subtraction
        hash &= hash; // Convert to 32bit integer
    }
    return Math.abs(hash); // Ensure positive number
}

/**
 * Generates a random number between 0 and 1.
 *
 * @param seed - The seed value used to generate the random number.
 * @returns A random number between 0 (inclusive) and 1 (exclusive).
 */
function seededRandom(seed: number): number {
    var x = Math.sin(seed) * 10000; // how many decimal places
    return x - Math.floor(x);
}

function generatePin(length: number) {
    if (length <= 0) return "";
    const min = 10 ** (length - 1);
    const max = 10 ** length - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

function sampleFrom<T>(items: T[], count: number, seed: number): T[] {
    const shuffled = [...items];
    let currentIndex = shuffled.length;
    let randomIndex: number;

    while (currentIndex !== 0) {
        randomIndex = Math.floor(seededRandom(seed) * currentIndex);
        currentIndex--;
        [shuffled[currentIndex], shuffled[randomIndex]] = [
            shuffled[randomIndex],
            shuffled[currentIndex],
        ];
    }

    return shuffled.slice(0, count);
}

function generateRandomSeed(rand?: number): number {
    rand = rand ?? Math.random();
    // Define the range for the seed, e.g., 0 to 2^32 - 1
    const maxSeed = Math.pow(2, 32) - 1;
    // Generate a random integer within the range
    return Math.floor(rand * maxSeed);
}

function seededRandomNumberBetween(
    min: number,
    max: number,
    seed: number,
): number {
    return Math.floor(seededRandom(seed) * (max - min + 1) + min);
}

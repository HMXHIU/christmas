declare global {
    interface Window {
        solana: any; // 👈️ turn off type checking
    }
}

interface Coupon {
    id: string;
    image: string;
    description: string;
    detailedDescription: string;
}

export { Coupon };

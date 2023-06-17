export {};

declare global {
    interface Window {
        solana: any; // 👈️ turn off type checking
    }
}

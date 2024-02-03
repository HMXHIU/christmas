// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
// and what to do when importing types

export interface UserSession {
    publicKey: string;
}

declare namespace App {
    interface Locals {
        user: UserSession | null;
    }
    // interface PageData {}
    // interface Error {}
    // interface Platform {}
}

declare global {
    interface Window {
        phantom: any;
        solana: any;
    }
}

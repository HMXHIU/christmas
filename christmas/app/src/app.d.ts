// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
// and what to do when importing types

declare namespace App {
    interface UserSession {
        publicKey: string;
    }
    interface Locals {
        user: UserSession | null;
        authToken: string | null;
    }
    interface PageData {}
    interface Error {}
    interface Platform {}
}

declare global {
    interface Window {
        phantom: any;
        solana: {
            signIn: any;
            connect: any;
            disconnect: any;
            publicKey: any;
        };
    }
}

interface Window {
    phantom: any;
    solana: {
        signIn: any;
        connect: any;
        disconnect: any;
        publicKey: any;
    };
}

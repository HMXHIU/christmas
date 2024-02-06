interface ConnectedUser {
    publicKey: string;
    stream: ReadableStreamDefaultController<any>;
}

// Record of connected users on this server instance
let connectedUsers: Record<string, ConnectedUser> = {};

// Exports
export { connectedUsers };

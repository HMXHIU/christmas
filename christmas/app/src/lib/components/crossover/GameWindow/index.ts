import { messageFeed } from "../../../../store";
import Root from "./GameWindow.svelte";

export default Root;

export { addMessageFeed, type MessageFeed, type MessageFeedType };

type MessageFeedType = "error" | "message" | "system" | "combat";
const MAX_MESSAGES = 30;
const TWO_MINUTE = 2 * 60 * 1000; // 2 minutes

interface MessageFeed {
    id: number;
    name: string;
    timestamp: Date;
    message: string;
    messageFeedType: MessageFeedType;
}

function addMessageFeed({
    message,
    name,
    messageFeedType,
}: {
    message: string;
    name: string;
    messageFeedType: MessageFeedType;
}) {
    messageFeed.update((ms) => {
        // Remove stale messages
        const currentTime = new Date().getTime();
        ms = ms.filter((m) => {
            return currentTime - m.timestamp.getTime() <= TWO_MINUTE;
        });
        // Add new message
        ms.push({
            id: ms.length,
            timestamp: new Date(),
            message,
            name,
            messageFeedType,
        });
        // Limit max number of messages
        return ms.slice(-MAX_MESSAGES);
    });
}

import { messageFeed } from "../../../../store";
import Root from "./GameWindow.svelte";

export default Root;

export {
    addMessageFeed,
    clearStaleMessageFeed,
    type MessageFeed,
    type MessageFeedType,
};

type MessageFeedType = "error" | "message" | "system";
const MAX_MESSAGES = 30;

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
        return [
            // Latest message at the top
            {
                id: ms.length,
                timestamp: new Date(),
                message,
                name,
                messageFeedType,
            },
            ...ms.slice(0, MAX_MESSAGES),
        ];
    });
}

function clearStaleMessageFeed() {
    const ONE_MINUTE = 60 * 1000; // 1 minute in milliseconds
    const currentTime = new Date().getTime();

    messageFeed.update((ms) => {
        return ms.filter((message) => {
            const messageTime = message.timestamp.getTime();
            return currentTime - messageTime <= ONE_MINUTE;
        });
    });
}

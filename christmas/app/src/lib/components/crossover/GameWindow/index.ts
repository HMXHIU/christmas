import { messageFeed } from "../../../../store";
import Root from "./GameWindow.svelte";

export default Root;

export { addMessageFeed, type MessageFeed, type MessageFeedType };

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

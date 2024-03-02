export interface MessageFeedUI {
    id: number;
    name: string;
    timestamp: string;
    message: string;
}

export interface ChatCommandGroupUI {
    key: string;
    label: string;
}

export interface ChatCommandUI {
    key: string;
    label: string;
    icon: any;
    shortcut: string | null;
    description: string | null;
}

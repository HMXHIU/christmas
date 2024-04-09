export interface AgentUI {
    id: number;
    avatar: string | null;
    name: string;
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

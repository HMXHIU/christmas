export { KeyboardController, type GameKey };

type GameKey =
    | "up"
    | "left"
    | "down"
    | "right"
    | "space"
    | "alt"
    | "ctrl"
    | "shift"
    | "enter"
    | "tab";

const EVENT_INTERVAL = 20;

const keyMap: Record<string, GameKey> = {
    Space: "space",
    ArrowUp: "up",
    ArrowLeft: "left",
    ArrowDown: "down",
    ArrowRight: "right",
    ShiftLeft: "shift",
    ShiftRight: "shift",
    ControlLeft: "ctrl",
    ControlRight: "ctrl",
    AltLeft: "alt",
    AltRight: "alt",
    Tab: "tab",
    Enter: "enter",
};

class KeyboardController {
    keys: Record<string, boolean> = {
        up: false,
        left: false,
        down: false,
        right: false,
        space: false,
        alt: false,
        ctrl: false,
        shift: false,
    };

    event: EventTarget = new EventTarget();

    subscribe(onKeys: (keys: GameKey[]) => void) {
        window.addEventListener("keydown", (event) =>
            this.keydownHandler(event),
        );
        window.addEventListener("keyup", (event) => this.keyupHandler(event));
        function onEvent(event: Event) {
            onKeys((event as CustomEvent).detail);
        }
        this.event.addEventListener("keys", onEvent);

        // Return unsubscribe function
        return () => {
            window.removeEventListener("keydown", (event) =>
                this.keydownHandler(event),
            );
            window.removeEventListener("keyup", (event) =>
                this.keyupHandler(event),
            );
            this.event.removeEventListener("keys", onEvent);
        };
    }

    checkValidEvents() {
        this.event.dispatchEvent(
            new CustomEvent("keys", {
                detail: Object.entries(this.keys)
                    .filter(([key, value]) => value)
                    .map(([key, value]) => key),
            }),
        );
    }

    keydownHandler(event: KeyboardEvent) {
        const key = keyMap[event.code];
        if (key) {
            this.keys[key] = true;
            setTimeout(() => {
                this.checkValidEvents();
            }, EVENT_INTERVAL);
        }
    }

    keyupHandler(event: KeyboardEvent) {
        const key = keyMap[event.code];
        if (key) {
            this.keys[key] = false;
        }
    }
}

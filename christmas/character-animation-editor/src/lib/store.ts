import { writable } from "svelte/store";
import type { Avatar } from "./avatar/Avatar";

export const avatar = writable<Avatar | null>(null);

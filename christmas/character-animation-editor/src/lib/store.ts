import type { Avatar } from "../../../app/src/lib/components/crossover/avatar/Avatar";

import { writable } from "svelte/store";

export const avatar = writable<Avatar | null>(null);

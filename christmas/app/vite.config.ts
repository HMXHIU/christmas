import { purgeCss } from "vite-plugin-tailwind-purgecss";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
    envDir: "../",
    plugins: [sveltekit(), purgeCss(), nodePolyfills()],
    define: {},
    resolve: {
        alias: {
            process: "process/browser",
            buffer: "buffer/",
        },
    },
    build: {
        rollupOptions: {
            external: [
                "vite-plugin-node-polyfills/shims/buffer",
                "vite-plugin-node-polyfills/shims/global",
                "vite-plugin-node-polyfills/shims/process",
            ],
        },
    },
});

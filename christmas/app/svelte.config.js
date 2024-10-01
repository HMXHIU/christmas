// import adapter from "@sveltejs/adapter-auto";
import adapterNode from "@sveltejs/adapter-node";
import adapterStatic from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
    extensions: [".svelte"],
    // Consult https://kit.svelte.dev/docs/integrations#preprocessors
    // for more information about preprocessors
    preprocess: [vitePreprocess()],
    kit: {
        // adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
        // If your environment is not supported or you settled on a specific environment, switch out the adapter.
        // See https://kit.svelte.dev/docs/adapters for more information about adapters.
        adapter:
            process.env.ADAPTER === "node"
                ? adapterNode({
                      out: "build-server", // only need the `build-server/server` folder
                  })
                : adapterStatic({
                      fallback: "index.html", // may differ from host to host
                  }),
        env: {
            dir: "../",
        },
        csrf: false, // TODO: set only for development
    },
};
export default config;

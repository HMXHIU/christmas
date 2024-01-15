import { purgeCss } from 'vite-plugin-tailwind-purgecss';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
	envDir: '../',
	plugins: [nodePolyfills(), sveltekit(), purgeCss()],
	define: {
		// process: {
		// 	env: {
		// 		NODE_DEBUG: false
		// 	}
		// }
	},
	resolve: {
		alias: {
			process: 'process/browser'
		}
	}
});

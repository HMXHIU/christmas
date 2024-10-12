<script lang="ts">
    import { Copy } from "lucide-svelte";
    import QuickToolTip from "./QuickToolTip.svelte";

    export let text: string;
    export let notify: boolean = false;

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(text);
            if (notify) {
                alert(text);
            }
        } catch (err) {
            console.error("Failed to copy: ", err);
        }
    };
</script>

<QuickToolTip {text}>
    <button on:click={copyToClipboard} aria-label="Copy">
        <Copy size={16} />
    </button>
</QuickToolTip>

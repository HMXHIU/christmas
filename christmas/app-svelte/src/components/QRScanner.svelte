<script lang="ts">
    import type { SvelteComponent } from "svelte";
    import { getModalStore } from "@skeletonlabs/skeleton";
    import { onMount } from "svelte";
    import { Html5Qrcode } from "html5-qrcode";
    import { extractQueryParams } from "../../../lib/utils";

    export let parent: SvelteComponent;

    const modalStore = getModalStore();

    let qrParams: any = {};

    onMount(() => {
        const html5QrCode = new Html5Qrcode("reader");

        html5QrCode.start(
            { facingMode: "environment" }, // front camera
            {
                fps: 10,
                qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
                    return { width: viewfinderWidth, height: viewfinderHeight };
                },
            },
            onScanSuccess,
            onScanFailure,
        );
    });

    function onScanSuccess(decodedText: string, decodedResult: any) {
        qrParams = extractQueryParams(decodedText);
        console.log(JSON.stringify(qrParams, null, 2));
    }

    function onScanFailure(error: any) {}
</script>

{#if $modalStore[0]}
    <div class="card shadow-xl w-full">
        <header class="w-full">
            <div id="reader" class="w-full"></div>
        </header>
        <section class="p-4">
            {#each Object.entries(qrParams) as [key, value]}
                <p>
                    {key}: {value}
                </p>
            {/each}
        </section>
        <footer class="modal-footer p-4">
            <button class="btn {parent.buttonNeutral}" on:click={parent.onClose}
                >Close</button
            >
        </footer>
    </div>
{/if}

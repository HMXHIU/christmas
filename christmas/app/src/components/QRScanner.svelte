<script lang="ts">
    import type { SvelteComponent } from "svelte";
    import { getModalStore } from "@skeletonlabs/skeleton";
    import { onMount } from "svelte";
    import { Html5Qrcode } from "html5-qrcode";
    import { extractQueryParams } from "$lib/clients/utils";

    export let parent: SvelteComponent;

    const modalStore = getModalStore();

    let html5QrCode: Html5Qrcode;
    let qrParams: any = {};

    onMount(() => {
        html5QrCode = new Html5Qrcode("reader");

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

        // Stop scanning on dismount
        return () => {
            html5QrCode.stop();
        };
    });

    async function onScanSuccess(decodedText: string, decodedResult: any) {
        qrParams = extractQueryParams(decodedText);
        // Return modal response
        if ($modalStore[0].response) {
            await html5QrCode
                .stop()
                .then((ignore) => {
                    // QR Code scanning is stopped.
                })
                .catch((err) => {
                    // Stop failed, handle it.
                });
            $modalStore[0].response(qrParams);
        }
    }

    function onScanFailure(error: any) {}
</script>

{#if $modalStore[0]}
    <div class="card shadow-xl w-full">
        <header class="w-full">
            <div id="reader" class="w-full"></div>
        </header>
        <footer class="modal-footer p-4">
            <button class="btn {parent.buttonNeutral}" on:click={parent.onClose}
                >Done</button
            >
        </footer>
    </div>
{/if}

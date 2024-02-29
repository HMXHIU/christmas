<script lang="ts">
    import { onMount } from "svelte";
    import { Html5Qrcode } from "html5-qrcode";
    import * as Card from "$lib/components/ui/card";

    let html5QrCode: Html5Qrcode;

    // callback on scan success
    export let onScanSuccess: (decodedText: string, decodedResult: any) => void;

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

    function onScanFailure(error: any) {}
</script>

<Card.Root class="w-full">
    <Card.Content class="w-full flex p-0">
        <div id="reader" class="w-full"></div>
    </Card.Content>
</Card.Root>

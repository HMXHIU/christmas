<script lang="ts">
    import { verifyRedemption } from "$lib/community";
    import QrScanner from "$lib/components/common/QRScanner.svelte";
    import QrSvg from "$lib/components/svg/QrSvg.svelte";
    import * as AlertDialog from "$lib/components/ui/alert-dialog";
    import { Button } from "$lib/components/ui/button";
    import * as Dialog from "$lib/components/ui/dialog";
    import { extractQueryParams, getErrorMessage } from "$lib/utils";
    import { Dialog as BitsDialog } from "bits-ui";

    let qrAlertOpen: boolean = false;
    let verifyRemdeptionParams: any = {};

    async function onScanSuccess(decodedText: string, decodedResult: any) {
        const qrParams = extractQueryParams(decodedText);

        if (qrParams) {
            const { signature, mint, numTokens, wallet } = qrParams;

            // Verify redemption
            try {
                verifyRemdeptionParams = {
                    signature,
                    mint,
                    numTokens,
                    wallet,
                    verifyRedemption: await verifyRedemption({
                        signature,
                        mint,
                        numTokens: parseInt(numTokens),
                        wallet,
                    }),
                };
            } catch (err: any) {
                verifyRemdeptionParams = {
                    signature,
                    mint,
                    numTokens,
                    wallet,
                    verifyRedemption: {
                        isVerified: false,
                        err: err.message,
                    },
                };
            }

            // Open alert dialog
            qrAlertOpen = true;
        }
    }
</script>

<!-- Page Footer -->
<footer class="py-3 fixed w-full bottom-0 z-50 bg-secondary pl-2">
    <!-- QR Scanner -->
    <div class="relative h-0 flex justify-center">
        <Dialog.Root>
            <Dialog.Trigger>
                <Button
                    size="icon"
                    variant="ghost"
                    class="relative w-14 h-14 -top-4 -right-[calc(50%-2rem)] rounded-full bg-transparent hover:bg-transparent"
                >
                    <QrSvg />
                </Button>
            </Dialog.Trigger>
            <Dialog.Content>
                <Dialog.Header>
                    <Dialog.Title class="flex justify-center p-4"
                        ><QrSvg /></Dialog.Title
                    >
                    <Dialog.Description>
                        Scan any community /// crossover related QR Code
                    </Dialog.Description>
                </Dialog.Header>
                <QrScanner {onScanSuccess} />
                <Dialog.Footer>
                    <BitsDialog.Close class="w-full">
                        <Button>Close</Button>
                    </BitsDialog.Close>
                </Dialog.Footer>
            </Dialog.Content>
        </Dialog.Root>
    </div>

    <!-- QR Scan Alert -->
    <AlertDialog.Root bind:open={qrAlertOpen}>
        <AlertDialog.Content>
            <AlertDialog.Header>
                <AlertDialog.Title>Verifying Redemption</AlertDialog.Title>
                <AlertDialog.Description>
                    {verifyRemdeptionParams.verifyRedemption.isVerified
                        ? `✅ Redemption Verified`
                        : `❌ ${getErrorMessage(
                              verifyRemdeptionParams.verifyRedemption.err,
                          )}`}
                </AlertDialog.Description>
            </AlertDialog.Header>
            {#if !verifyRemdeptionParams.verifyRedemption.isVerified}
                <img
                    src="https://i.imgur.com/WOgTG96.gif"
                    alt="redemption unverified"
                />
            {/if}
            <AlertDialog.Footer>
                <AlertDialog.Cancel>Close</AlertDialog.Cancel>
            </AlertDialog.Footer>
        </AlertDialog.Content>
    </AlertDialog.Root>

    <!-- Coupons / Mint -->
    <div class="grid grid-cols-3 justify-center">
        <a href="/coupons" class="place-self-end">Coupons</a>
        <div></div>
        <a href="/mint" class="place-self-start">Mint</a>
    </div>
</footer>

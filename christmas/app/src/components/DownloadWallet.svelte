<script lang="ts">
    import { getModalStore } from "@skeletonlabs/skeleton";
    const modalStore = getModalStore();
</script>

{#if $modalStore[0]}
    <div class="card w-modal shadow-xl">
        <header class="card-header flex flex-col">
            <img
                src="https://3632261023-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-MVOiF6Zqit57q_hxJYp%2Fuploads%2FHEjleywo9QOnfYebBPCZ%2FPhantom_SVG_Icon.svg?alt=media&token=71b80a0a-def7-4f98-ae70-5e0843fdaaec"
                alt="Phantom Wallet"
                class="h-64"
            />
        </header>
        <section class="p-4">
            You need a web3 wallet to proceed, we currently only allow Phantom.
        </section>
        <footer class="card-footer flex flex-col">
            <a
                href="https://phantom.app/"
                target="_blank"
                class="btn variant-filled">Download Phantom Wallet</a
            >
        </footer>
    </div>
{/if}

<script lang="ts">
    import { player } from "../../../store";
</script>

<!-- Page Footer -->
<footer class="py-3 fixed w-full bottom-0 z-50 bg-secondary pl-2">
    <!-- Coupons / Mint -->
    <div class="grid grid-cols-4 justify-center">
        <p>HP: {$player?.hp}</p>
        <p>MP: {$player?.mp}</p>
        <p>ST: {$player?.st}</p>
        <p>AP: {$player?.ap}</p>
    </div>
</footer>

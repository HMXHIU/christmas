<script lang="ts">
	export let label: string = '';
	export let value: Date = new Date();
	$: dateString = value.toISOString().split('T')[0];

	function onDateChange(event: Event) {
		value = new Date(Date.parse((event.target as HTMLInputElement).value));
	}
</script>

<div class="label">
	<span>{label}</span>
	<input class="input" type="date" value={dateString} on:change={onDateChange} />
</div>

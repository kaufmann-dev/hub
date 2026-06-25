<script lang="ts">
	import HubPage from './+page.svelte';

	let { data } = $props();
</script>

<HubPage {data} />

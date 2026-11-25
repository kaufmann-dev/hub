<script lang="ts">
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import HubPage from './+page.svelte';

	let { data } = $props();
</script>

<Tooltip.Provider>
	<HubPage {data} />
</Tooltip.Provider>

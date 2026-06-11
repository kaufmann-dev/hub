<script lang="ts">
	import { ExternalLink } from '@lucide/svelte';

	let { src }: { src: string } = $props();
	let failedSrc = $state<string | null>(null);
</script>

{#if failedSrc === src}
	<ExternalLink class="text-muted-foreground mt-0.5 size-6 shrink-0" />
{:else}
	<img
		{src}
		alt=""
		class="mt-0.5 size-6 shrink-0 rounded"
		loading="lazy"
		onerror={() => (failedSrc = src)}
	/>
{/if}

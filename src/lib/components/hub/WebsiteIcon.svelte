<script lang="ts">
	import { ExternalLink } from '@lucide/svelte';
	import { mode } from 'mode-watcher';

	let { lightSrc, darkSrc }: { lightSrc: string; darkSrc: string } = $props();
	let failed = $state.raw<string[]>([]);
	let src = $derived(mode.current === 'dark' ? darkSrc : lightSrc);

	function markFailed(event: Event) {
		const failedSrc = (event.currentTarget as HTMLImageElement).getAttribute('src');
		if (failedSrc && !failed.includes(failedSrc)) failed = [...failed, failedSrc];
	}
</script>

{#if failed.includes(src)}
	<ExternalLink class="text-muted-foreground mt-0.5 size-6 shrink-0" />
{:else}
	<img {src} alt="" class="mt-0.5 size-6 shrink-0 rounded" loading="lazy" onerror={markFailed} />
{/if}

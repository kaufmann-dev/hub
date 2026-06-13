<script lang="ts">
	import { ExternalLink } from '@lucide/svelte';

	let { lightSrc, darkSrc }: { lightSrc: string; darkSrc: string } = $props();
	let failed = $state.raw<string[]>([]);

	function markFailed(event: Event) {
		const failedSrc = (event.currentTarget as HTMLImageElement).getAttribute('src');
		if (failedSrc && !failed.includes(failedSrc)) failed = [...failed, failedSrc];
	}
</script>

{#if failed.includes(lightSrc)}
	<ExternalLink class="text-muted-foreground mt-0.5 size-6 shrink-0 dark:hidden" />
{:else}
	<img
		src={lightSrc}
		alt=""
		class="mt-0.5 size-6 shrink-0 rounded dark:hidden"
		loading="lazy"
		onerror={markFailed}
	/>
{/if}

{#if failed.includes(darkSrc)}
	<ExternalLink class="text-muted-foreground mt-0.5 hidden size-6 shrink-0 dark:block" />
{:else}
	<img
		src={darkSrc}
		alt=""
		class="mt-0.5 hidden size-6 shrink-0 rounded dark:block"
		loading="lazy"
		onerror={markFailed}
	/>
{/if}

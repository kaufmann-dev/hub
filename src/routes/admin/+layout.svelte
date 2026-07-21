<script lang="ts">
	import SessionActivity from '$lib/components/admin/session-activity.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

{#if data.isAdmin}
	<SessionActivity />
{/if}

{@render children()}

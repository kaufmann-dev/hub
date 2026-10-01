<script lang="ts">
	import type { Path } from '$app/types';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { locales, localizeHref } from '#lib/paraglide/runtime.js';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '#lib/components/ui/sonner/index.js';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<ModeWatcher />
<Toaster position="bottom-right" closeButton />
<Tooltip.Provider>
	{@render children()}
</Tooltip.Provider>

<div style="display:none">
	{#each locales as locale (locale)}
		<a href={resolve(localizeHref(page.url.pathname, { locale }).slice(1) as Path)}>{locale}</a>
	{/each}
</div>

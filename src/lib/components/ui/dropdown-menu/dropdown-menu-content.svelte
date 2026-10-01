<script lang="ts">
	import { cn, type WithoutChildrenOrChild } from '#lib/utils.js';
	import DropdownMenuPortal from './dropdown-menu-portal.svelte';
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		sideOffset = 4,
		align = 'start',
		portalProps,
		class: className,
		...restProps
	}: DropdownMenuPrimitive.ContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof DropdownMenuPortal>>;
	} = $props();
</script>

<DropdownMenuPortal {...portalProps}>
	<DropdownMenuPrimitive.Content
		bind:ref
		data-slot="dropdown-menu-content"
		{sideOffset}
		{align}
		class={cn(
			'z-50 w-(--bits-dropdown-menu-anchor-width) min-w-32 overflow-x-hidden overflow-y-auto rounded-2xl bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/5 outline-none dark:ring-foreground/10 data-closed:overflow-hidden',
			className
		)}
		{...restProps}
	/>
</DropdownMenuPortal>

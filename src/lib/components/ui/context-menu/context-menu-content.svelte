<script lang="ts">
	import { ContextMenu as ContextMenuPrimitive } from 'bits-ui';
	import { cn } from '#lib/utils.js';
	import ContextMenuPortal from './context-menu-portal.svelte';
	import type { ComponentProps } from 'svelte';
	import type { WithoutChildrenOrChild } from '#lib/utils.js';

	let {
		ref = $bindable(null),
		portalProps,
		class: className,
		...restProps
	}: ContextMenuPrimitive.ContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof ContextMenuPortal>>;
	} = $props();
</script>

<ContextMenuPortal {...portalProps}>
	<ContextMenuPrimitive.Content
		bind:ref
		data-slot="context-menu-content"
		class={cn(
			'z-50 min-w-36 overflow-x-hidden overflow-y-auto rounded-2xl bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/5 outline-none dark:ring-foreground/10',
			className
		)}
		{...restProps}
	/>
</ContextMenuPortal>

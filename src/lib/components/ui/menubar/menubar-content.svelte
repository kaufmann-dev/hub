<script lang="ts">
	import { Menubar as MenubarPrimitive } from 'bits-ui';
	import MenubarPortal from './menubar-portal.svelte';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		class: className,
		sideOffset = 8,
		alignOffset = -4,
		align = 'start',
		side = 'bottom',
		portalProps,
		...restProps
	}: MenubarPrimitive.ContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof MenubarPortal>>;
	} = $props();
</script>

<MenubarPortal {...portalProps}>
	<MenubarPrimitive.Content
		bind:ref
		data-slot="menubar-content"
		{align}
		{alignOffset}
		{side}
		{sideOffset}
		class={cn(
			'bg-popover text-popover-foreground ring-foreground/10 z-50 min-w-36 origin-(--bits-menubar-content-transform-origin) overflow-hidden rounded-lg p-1 shadow-md ring-1',
			className
		)}
		{...restProps}
	/>
</MenubarPortal>

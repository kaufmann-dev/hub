<script lang="ts">
	import { LinkPreview as HoverCardPrimitive } from 'bits-ui';
	import { cn, type WithoutChildrenOrChild } from '#lib/utils.js';
	import HoverCardPortal from './hover-card-portal.svelte';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		class: className,
		align = 'center',
		sideOffset = 4,
		portalProps,
		...restProps
	}: HoverCardPrimitive.ContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof HoverCardPortal>>;
	} = $props();
</script>

<HoverCardPortal {...portalProps}>
	<HoverCardPrimitive.Content
		bind:ref
		data-slot="hover-card-content"
		{align}
		{sideOffset}
		class={cn(
			'z-50 w-72 origin-(--transform-origin) rounded-3xl bg-popover p-4 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/5 outline-hidden dark:ring-foreground/10',
			className
		)}
		{...restProps}
	/>
</HoverCardPortal>

<script lang="ts">
	import { ContextMenu as ContextMenuPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: ContextMenuPrimitive.SubContentProps = $props();
</script>

<ContextMenuPrimitive.SubContent
	bind:ref
	data-slot="context-menu-sub-content"
	class={cn(
		'ring-foreground/5 dark:ring-foreground/10 bg-popover text-popover-foreground min-w-32 rounded-2xl p-1 shadow-lg ring-1',
		className
	)}
	{...restProps}
/>

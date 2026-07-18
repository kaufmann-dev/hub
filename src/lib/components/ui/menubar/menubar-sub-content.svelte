<script lang="ts">
	import { Menubar as MenubarPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: MenubarPrimitive.SubContentProps = $props();
</script>

<MenubarPrimitive.SubContent
	bind:ref
	data-slot="menubar-sub-content"
	class={cn(
		'bg-popover text-popover-foreground ring-foreground/5 dark:ring-foreground/10 min-w-32 rounded-2xl p-1 shadow-lg ring-1',
		className
	)}
	{...restProps}
/>

<script lang="ts">
	import { Menubar as MenubarPrimitive } from 'bits-ui';
	import { cn } from '#lib/utils.js';

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
		'min-w-32 rounded-2xl bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/5 dark:ring-foreground/10',
		className
	)}
	{...restProps}
/>

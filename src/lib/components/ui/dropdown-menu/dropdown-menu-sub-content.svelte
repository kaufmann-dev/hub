<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import { cn } from '#lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: DropdownMenuPrimitive.SubContentProps = $props();
</script>

<DropdownMenuPrimitive.SubContent
	bind:ref
	data-slot="dropdown-menu-sub-content"
	class={cn(
		'w-auto min-w-[96px] rounded-2xl bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/5 dark:ring-foreground/10',
		className
	)}
	{...restProps}
/>

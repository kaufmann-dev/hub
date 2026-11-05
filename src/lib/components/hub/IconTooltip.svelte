<script lang="ts">
	import type { ComponentProps, Snippet } from 'svelte';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import { cn } from '#lib/utils.js';

	let {
		message,
		children,
		class: className,
		...restProps
	}: Pick<ComponentProps<typeof Tooltip.Trigger>, 'class' | 'aria-label'> & {
		message: string;
		children: Snippet;
		'data-health-status'?: string;
		'data-archived'?: boolean;
		'data-dependabot-alerts'?: string;
	} = $props();

	let open = $state(false);
</script>

<Tooltip.Root bind:open disableCloseOnTriggerClick>
	<Tooltip.Trigger
		type="button"
		aria-label={message}
		class={cn(
			'inline-flex size-6 shrink-0 cursor-help items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
			className
		)}
		{...restProps}
		onclick={() => (open = true)}
	>
		<span class="inline-flex" aria-hidden="true">{@render children()}</span>
	</Tooltip.Trigger>
	<Tooltip.Content sideOffset={4}>{message}</Tooltip.Content>
</Tooltip.Root>

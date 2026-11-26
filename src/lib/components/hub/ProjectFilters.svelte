<script lang="ts" module>
	export type ProjectVisibility = 'private' | 'public';
	export type ProjectStatus = 'archived' | 'dependabot-on' | 'dependabot-off';
</script>

<script lang="ts">
	import type { Component } from 'svelte';
	import { Archive, Globe, Lock, ShieldCheck, ShieldOff } from '@lucide/svelte';
	import * as ToggleGroup from '#lib/components/ui/toggle-group/index.js';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import { cn } from '#lib/utils.js';

	let {
		visibility = $bindable([]),
		status = $bindable([]),
		class: className
	}: {
		visibility?: ProjectVisibility[];
		status?: ProjectStatus[];
		class?: string;
	} = $props();

	type FilterItem<T extends string> = {
		value: T;
		label: string;
		icon: Component<{ class?: string }>;
		pressedClass: string;
	};

	const visibilityItems: FilterItem<ProjectVisibility>[] = [
		{
			value: 'private',
			label: 'Private',
			icon: Lock,
			pressedClass: 'data-[state=on]:text-foreground'
		},
		{
			value: 'public',
			label: 'Public',
			icon: Globe,
			pressedClass: 'data-[state=on]:text-foreground'
		}
	];

	const statusItems: FilterItem<ProjectStatus>[] = [
		{
			value: 'archived',
			label: 'Archived',
			icon: Archive,
			pressedClass: 'data-[state=on]:text-amber-500'
		},
		{
			value: 'dependabot-on',
			label: 'Dependabot alerts enabled',
			icon: ShieldCheck,
			pressedClass: 'data-[state=on]:text-emerald-500'
		},
		{
			value: 'dependabot-off',
			label: 'Dependabot alerts disabled',
			icon: ShieldOff,
			pressedClass: 'data-[state=on]:text-red-500'
		}
	];
</script>

{#snippet filterItem(item: FilterItem<string>)}
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<ToggleGroup.Item
					{...props}
					value={item.value}
					aria-label={item.label}
					class={cn('text-muted-foreground', item.pressedClass)}
				>
					<item.icon class="size-3.5" />
				</ToggleGroup.Item>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content sideOffset={4}>{item.label}</Tooltip.Content>
	</Tooltip.Root>
{/snippet}

<div class={cn('flex shrink-0 items-center gap-2', className)}>
	<ToggleGroup.Root
		type="multiple"
		variant="outline"
		size="sm"
		bind:value={visibility}
		aria-label="Filter by visibility"
	>
		{#each visibilityItems as item (item.value)}
			{@render filterItem(item)}
		{/each}
	</ToggleGroup.Root>
	<ToggleGroup.Root
		type="multiple"
		variant="outline"
		size="sm"
		bind:value={status}
		aria-label="Filter by status"
	>
		{#each statusItems as item (item.value)}
			{@render filterItem(item)}
		{/each}
	</ToggleGroup.Root>
</div>

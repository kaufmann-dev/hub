<script lang="ts">
	import { flip } from 'svelte/animate';
	import { fromAction } from 'svelte/attachments';
	import { prefersReducedMotion } from 'svelte/motion';
	import type { Snippet } from 'svelte';
	import { GripVertical } from '@lucide/svelte';
	import {
		dragHandle,
		dragHandleZone,
		type DndEvent,
		type Options as DndOptions
	} from 'svelte-dnd-action';
	import type { AdminSortItem } from '$lib/admin/reorder';

	type Props = {
		items: AdminSortItem[];
		label: string;
		zoneType: string;
		disabled?: boolean;
		emptyLabel?: string;
		onConsider: (event: CustomEvent<DndEvent<AdminSortItem>>) => void;
		onFinalize: (event: CustomEvent<DndEvent<AdminSortItem>>) => void;
		row: Snippet<[AdminSortItem]>;
	};

	let {
		items,
		label,
		zoneType,
		disabled = false,
		emptyLabel = 'Drop items here',
		onConsider,
		onFinalize,
		row
	}: Props = $props();

	let flipDurationMs = $derived(prefersReducedMotion.current ? 0 : 70);
	let zoneOptions = $derived<DndOptions<AdminSortItem>>({
		items,
		type: zoneType,
		flipDurationMs,
		dragDisabled: disabled,
		dropTargetClasses: ['admin-sort-drop-target'],
		delayTouchStart: true,
		useCursorForDetection: true
	});

	function dndEventListeners(node: HTMLElement) {
		const handleConsider = (event: Event) =>
			onConsider(event as CustomEvent<DndEvent<AdminSortItem>>);
		const handleFinalize = (event: Event) =>
			onFinalize(event as CustomEvent<DndEvent<AdminSortItem>>);

		node.addEventListener('consider', handleConsider);
		node.addEventListener('finalize', handleFinalize);

		return () => {
			node.removeEventListener('consider', handleConsider);
			node.removeEventListener('finalize', handleFinalize);
		};
	}
</script>

<div class="relative">
	<ol
		class={[
			'list-none space-y-3 rounded-lg',
			items.length === 0 && 'border-border/80 min-h-16 border border-dashed'
		]}
		aria-label={label}
		data-sort-zone={zoneType}
		{@attach fromAction(dragHandleZone, () => zoneOptions)}
		{@attach dndEventListeners}
	>
		{#each items as item (item.id)}
			<li
				class={[
					'bg-card relative flex items-center gap-3 rounded-lg border py-3 pr-3 pl-12 shadow-xs',
					item.hidden && !item.isDndShadowItem && 'opacity-50',
					item.isDndShadowItem && 'border-primary/45 bg-primary/5 border-dashed shadow-inner'
				]}
				aria-label={item.label}
				data-sort-item={item.rowId}
				data-sort-shadow={item.isDndShadowItem || undefined}
				animate:flip={{ duration: flipDurationMs }}
			>
				<div
					class={[
						'admin-sort-handle text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute inset-y-0 left-0 flex w-12 touch-none items-center justify-center rounded-l-lg outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset',
						disabled && 'pointer-events-none opacity-40'
					]}
					aria-label={`Reorder ${item.label}`}
					aria-disabled={disabled}
					{@attach fromAction(dragHandle)}
				>
					<GripVertical class="size-4" aria-hidden="true" />
				</div>
				{@render row(item)}
			</li>
		{/each}
	</ol>

	{#if items.length === 0}
		<div
			class="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-sm"
			aria-hidden="true"
		>
			{emptyLabel}
		</div>
	{/if}
</div>

<style>
	:global(.admin-sort-drop-target) {
		background: color-mix(in oklab, var(--accent) 55%, transparent);
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--ring) 38%, transparent);
	}

	:global(#dnd-action-dragged-el) {
		border-color: color-mix(in oklab, var(--ring) 55%, transparent);
		box-shadow:
			0 22px 45px -18px color-mix(in oklab, var(--foreground) 30%, transparent),
			0 8px 18px -12px color-mix(in oklab, var(--foreground) 24%, transparent);
		opacity: 0.98;
		rotate: 0.2deg;
		scale: 1.01;
	}

	:global(#dnd-action-dragged-el .admin-sort-handle) {
		background: var(--accent);
		color: var(--accent-foreground);
	}

	@media (prefers-reduced-motion: reduce) {
		:global(#dnd-action-dragged-el) {
			rotate: none;
			scale: none;
		}
	}
</style>

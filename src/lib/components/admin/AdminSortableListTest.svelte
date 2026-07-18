<script lang="ts">
	import type { DndEvent } from 'svelte-dnd-action';
	import type { AdminSortItem } from '$lib/admin/reorder';
	import AdminSortableList from './AdminSortableList.svelte';
	import '../../../routes/layout.css';

	let primary = $state.raw<AdminSortItem[]>([
		{ id: 1, rowId: 1, label: 'Alpha', hidden: false },
		{ id: 2, rowId: 2, label: 'Bravo', hidden: false },
		{ id: 3, rowId: 3, label: 'Charlie', hidden: false }
	]);
	let secondary = $state.raw<AdminSortItem[]>([]);
	let actionCount = $state(0);

	function updatePrimary(event: CustomEvent<DndEvent<AdminSortItem>>) {
		primary = event.detail.items;
	}

	function updateSecondary(event: CustomEvent<DndEvent<AdminSortItem>>) {
		secondary = event.detail.items;
	}

	function labels(items: AdminSortItem[]): string {
		return items
			.filter((item) => !item.isDndShadowItem)
			.map((item) => item.label)
			.join(',');
	}
</script>

<div class="space-y-6 p-6">
	<AdminSortableList
		items={primary}
		label="Primary"
		zoneType="sortable-test"
		emptyLabel="Drop into primary"
		onConsider={updatePrimary}
		onFinalize={updatePrimary}
	>
		{#snippet row(item)}
			<span class="min-w-0 flex-1">{item.label}</span>
			<button type="button" aria-label={`Edit ${item.label}`} onclick={() => (actionCount += 1)}>
				Edit
			</button>
		{/snippet}
	</AdminSortableList>

	<AdminSortableList
		items={secondary}
		label="Secondary"
		zoneType="sortable-test"
		emptyLabel="Drop into secondary"
		onConsider={updateSecondary}
		onFinalize={updateSecondary}
	>
		{#snippet row(item)}
			<span class="min-w-0 flex-1">{item.label}</span>
		{/snippet}
	</AdminSortableList>

	<output aria-label="Primary order">{labels(primary)}</output>
	<output aria-label="Secondary order">{labels(secondary)}</output>
	<output aria-label="Action count">{actionCount}</output>
</div>

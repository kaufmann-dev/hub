import { describe, expect, it } from 'vitest';
import {
	flattenZoneIds,
	groupValueById,
	replaceZone,
	rowIds,
	sameOrder,
	sameRecord,
	toSortItems,
	type AdminSortItem
} from './reorder';

const alpha: AdminSortItem = { id: 1, rowId: 1, label: 'Alpha', hidden: false };
const bravo: AdminSortItem = { id: 2, rowId: 2, label: 'Bravo', hidden: false };
const shadow: AdminSortItem = {
	id: 'id:dnd-shadow-placeholder-0000',
	rowId: 3,
	label: 'Charlie',
	hidden: false,
	isDndShadowItem: true
};

describe('admin reorder helpers', () => {
	it('converts rows into stable sortable items', () => {
		const items = toSortItems(
			[
				{ id: 1, title: 'Alpha', hidden: false },
				{ id: 2, title: 'Bravo', hidden: true }
			],
			(row) => row.title,
			(row) => row.hidden
		);

		expect(items).toEqual([
			{ id: 1, rowId: 1, label: 'Alpha', hidden: false },
			{ id: 2, rowId: 2, label: 'Bravo', hidden: true }
		]);
	});

	it('replaces one zone without mutating the others', () => {
		const zones = { active: [alpha, bravo], inactive: [] as AdminSortItem[] };
		const next = replaceZone(zones, 'inactive', [bravo]);

		expect(next).toEqual({ active: [alpha, bravo], inactive: [bravo] });
		expect(zones.inactive).toEqual([]);
	});

	it('omits the temporary shadow item from persisted ids', () => {
		expect(rowIds([alpha, shadow, bravo])).toEqual([1, 2]);
	});

	it('flattens zones in canonical order and derives membership values', () => {
		const zones = { personal: [bravo], third_party: [alpha] };

		expect(flattenZoneIds(zones, ['personal', 'third_party'])).toEqual([2, 1]);
		expect(groupValueById(zones, { personal: 'personal', third_party: 'third_party' })).toEqual({
			'1': 'third_party',
			'2': 'personal'
		});
	});

	it('detects unchanged orders and group records', () => {
		expect(sameOrder([1, 2, 3], [1, 2, 3])).toBe(true);
		expect(sameOrder([1, 2, 3], [2, 1, 3])).toBe(false);
		expect(sameRecord({ 1: false, 2: true }, { 2: true, 1: false })).toBe(true);
		expect(sameRecord({ 1: false }, { 1: true })).toBe(false);
	});
});

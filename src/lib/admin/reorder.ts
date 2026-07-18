export type AdminSortItem = {
	id: number | string;
	rowId: number;
	label: string;
	hidden: boolean;
	isDndShadowItem?: boolean;
};

export type SortZones<Group extends string> = Record<Group, AdminSortItem[]>;

export function toSortItems<T extends { id: number }>(
	rows: T[],
	label: (row: T) => string,
	hidden: (row: T) => boolean = () => false
): AdminSortItem[] {
	return rows.map((row) => ({
		id: row.id,
		rowId: row.id,
		label: label(row),
		hidden: hidden(row)
	}));
}

export function replaceZone<Group extends string>(
	zones: SortZones<Group>,
	group: Group,
	items: AdminSortItem[]
): SortZones<Group> {
	return { ...zones, [group]: [...items] };
}

export function rowIds(items: AdminSortItem[]): number[] {
	return items.filter((item) => !item.isDndShadowItem).map((item) => item.rowId);
}

export function flattenZoneIds<Group extends string>(
	zones: SortZones<Group>,
	groups: readonly Group[]
): number[] {
	return groups.flatMap((group) => rowIds(zones[group]));
}

export function groupValueById<Group extends string, Value>(
	zones: SortZones<Group>,
	values: Record<Group, Value>
): Record<string, Value> {
	return Object.fromEntries(
		(Object.keys(zones) as Group[]).flatMap((group) =>
			rowIds(zones[group]).map((id) => [String(id), values[group]])
		)
	);
}

export function sameOrder(left: number[], right: number[]): boolean {
	return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function sameRecord<Value>(
	left: Record<string, Value>,
	right: Record<string, Value>
): boolean {
	const leftKeys = Object.keys(left);
	return (
		leftKeys.length === Object.keys(right).length &&
		leftKeys.every((key) => Object.hasOwn(right, key) && left[key] === right[key])
	);
}

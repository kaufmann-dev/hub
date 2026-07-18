<script lang="ts">
	import { enhance } from '$app/forms';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		Plus,
		Pencil,
		Trash2,
		RefreshCw,
		LogOut,
		Eye,
		EyeOff,
		Star,
		ArrowLeft
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { SOURCES, TRIGGERS, type DndEvent } from 'svelte-dnd-action';
	import {
		flattenZoneIds,
		groupValueById,
		replaceZone,
		sameOrder,
		sameRecord,
		toSortItems,
		type AdminSortItem,
		type SortZones
	} from '$lib/admin/reorder';
	import AdminSortableList from '$lib/components/admin/AdminSortableList.svelte';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Tabs from '$lib/components/ui/tabs';
	import type { PageData } from './$types';

	type AdminTab = 'websites' | 'projects' | 'cities' | 'markets';
	type WebsiteKind = 'personal' | 'third_party';
	type ProjectGroup = 'active' | 'inactive';
	type Row = { id: number };
	type WebsiteZones = SortZones<WebsiteKind>;
	type ProjectZones = SortZones<ProjectGroup>;
	type SortEvent = CustomEvent<DndEvent<AdminSortItem>>;

	const adminTabs = ['websites', 'projects', 'cities', 'markets'] as const;
	const websiteGroupOrder = ['personal', 'third_party'] as const;
	const projectGroupOrder = ['active', 'inactive'] as const;
	const toastIds = {
		faviconRefresh: 'admin-favicon-refresh',
		projectSync: 'admin-project-sync',
		marketImport: 'admin-market-import',
		reorder: 'admin-reorder'
	} as const;

	let { data }: { data: PageData } = $props();
	let syncing = $state(false);
	let refreshingFavicons = $state(false);
	let importingMarkets = $state(false);
	let savingReorder = $state<AdminTab | null>(null);
	let websiteOrder = $state.raw<number[] | null>(null);
	let projectOrder = $state.raw<number[] | null>(null);
	let cityOrder = $state.raw<number[] | null>(null);
	let marketOrder = $state.raw<number[] | null>(null);
	let websiteKindOverrides = $state.raw<Record<string, WebsiteKind>>({});
	let projectHiddenOverrides = $state.raw<Record<string, boolean>>({});
	let websiteDraft = $state.raw<WebsiteZones | null>(null);
	let projectDraft = $state.raw<ProjectZones | null>(null);
	let cityDraft = $state.raw<AdminSortItem[] | null>(null);
	let marketDraft = $state.raw<AdminSortItem[] | null>(null);
	let activeTab = $derived(normalizeTab(page.url.searchParams.get('tab')));
	let displayedWebsites = $derived(
		orderedRows(data.websites, websiteOrder).map((site) => ({
			...site,
			kind: websiteKindFor(site)
		}))
	);
	let personalWebsites = $derived(displayedWebsites.filter((site) => site.kind === 'personal'));
	let thirdPartyWebsites = $derived(
		displayedWebsites.filter((site) => site.kind === 'third_party')
	);
	let websiteGroups = $derived([
		{
			id: 'personal' as const,
			title: 'Personal websites',
			emptyLabel: 'Drop personal websites here'
		},
		{
			id: 'third_party' as const,
			title: 'Third-party websites',
			emptyLabel: 'Drop third-party websites here'
		}
	]);
	let baseWebsiteZones = $derived<WebsiteZones>({
		personal: toSortItems(
			personalWebsites,
			(site) => site.title,
			(site) => site.hidden
		),
		third_party: toSortItems(
			thirdPartyWebsites,
			(site) => site.title,
			(site) => site.hidden
		)
	});
	let websiteZones = $derived(websiteDraft ?? baseWebsiteZones);
	let websiteById = $derived(new Map(displayedWebsites.map((site) => [site.id, site])));
	let displayedProjects = $derived(
		orderedRows(data.projects, projectOrder).map((project) => ({
			...project,
			hidden: projectHiddenFor(project)
		}))
	);
	let allHidden = $derived(displayedProjects.every((p) => p.hidden));
	let activeProjects = $derived(displayedProjects.filter((project) => !project.hidden));
	let inactiveProjects = $derived(displayedProjects.filter((project) => project.hidden));
	let projectGroups = $derived([
		{ id: 'active' as const, title: 'Active projects', emptyLabel: 'Drop active projects here' },
		{
			id: 'inactive' as const,
			title: 'Inactive projects',
			emptyLabel: 'Drop inactive projects here'
		}
	]);
	let baseProjectZones = $derived<ProjectZones>({
		active: toSortItems(activeProjects, (project) => project.name),
		inactive: toSortItems(
			inactiveProjects,
			(project) => project.name,
			() => true
		)
	});
	let projectZones = $derived(projectDraft ?? baseProjectZones);
	let projectById = $derived(new Map(displayedProjects.map((project) => [project.id, project])));
	let displayedCities = $derived(orderedRows(data.cities, cityOrder));
	let displayedMarkets = $derived(orderedRows(data.markets, marketOrder));
	let cityItems = $derived(
		cityDraft ??
			toSortItems(
				displayedCities,
				(city) => city.name,
				(city) => city.hidden
			)
	);
	let marketItems = $derived(
		marketDraft ??
			toSortItems(
				displayedMarkets,
				(market) => market.market.title,
				(market) => market.hidden
			)
	);
	let cityById = $derived(new Map(displayedCities.map((city) => [city.id, city])));
	let marketById = $derived(new Map(displayedMarkets.map((market) => [market.id, market])));

	function normalizeTab(tab: string | null): AdminTab {
		return adminTabs.includes(tab as AdminTab) ? (tab as AdminTab) : 'websites';
	}

	function setActiveTab(tab: string) {
		const nextTab = normalizeTab(tab);
		replaceState(resolve(`/admin?tab=${nextTab}`), page.state);
	}

	function orderedRows<T extends Row>(rows: T[], order: number[] | null): T[] {
		if (!order) return rows;

		const rowsById = new Map(rows.map((row) => [row.id, row]));
		const ordered = order.flatMap((id) => {
			const row = rowsById.get(id);
			return row ? [row] : [];
		});
		const orderedIds = new Set(order);
		return [...ordered, ...rows.filter((row) => !orderedIds.has(row.id))];
	}

	function asWebsiteKind(kind: string): WebsiteKind {
		return kind === 'third_party' ? 'third_party' : 'personal';
	}

	function websiteKindFor(site: PageData['websites'][number]): WebsiteKind {
		return websiteKindOverrides[String(site.id)] ?? asWebsiteKind(site.kind);
	}

	function projectHiddenFor(project: PageData['projects'][number]): boolean {
		return projectHiddenOverrides[String(project.id)] ?? project.hidden;
	}

	function websiteKindById(overrides = websiteKindOverrides): Record<string, WebsiteKind> {
		return Object.fromEntries(
			data.websites.map((site) => [
				String(site.id),
				overrides[String(site.id)] ?? asWebsiteKind(site.kind)
			])
		);
	}

	function projectHiddenById(overrides = projectHiddenOverrides): Record<string, boolean> {
		return Object.fromEntries(
			data.projects.map((project) => [
				String(project.id),
				overrides[String(project.id)] ?? project.hidden
			])
		);
	}

	function currentIds(type: AdminTab): number[] {
		if (type === 'websites') {
			return [...personalWebsites, ...thirdPartyWebsites].map((row) => row.id);
		}
		if (type === 'projects') return [...activeProjects, ...inactiveProjects].map((row) => row.id);
		if (type === 'markets') return displayedMarkets.map((row) => row.id);
		return displayedCities.map((row) => row.id);
	}

	function setOrder(type: AdminTab, ids: number[] | null) {
		if (type === 'websites') {
			websiteOrder = ids;
		} else if (type === 'projects') {
			projectOrder = ids;
		} else if (type === 'cities') {
			cityOrder = ids;
		} else {
			marketOrder = ids;
		}
	}

	function reorderBody(
		type: AdminTab,
		ids: number[],
		websiteKinds = websiteKindOverrides,
		projectHidden = projectHiddenOverrides
	) {
		if (type === 'websites') return { type, ids, kindById: websiteKindById(websiteKinds) };
		if (type === 'projects') return { type, ids, hiddenById: projectHiddenById(projectHidden) };
		return { type, ids };
	}

	function clearProjectOverrides() {
		projectHiddenOverrides = {};
		projectOrder = null;
		projectDraft = null;
	}

	function clearDraft(type: AdminTab) {
		if (type === 'websites') websiteDraft = null;
		else if (type === 'projects') projectDraft = null;
		else if (type === 'cities') cityDraft = null;
		else marketDraft = null;
	}

	async function persistReorder(
		type: AdminTab,
		nextIds: number[],
		nextWebsiteKinds = websiteKindById(),
		nextProjectHidden = projectHiddenById()
	) {
		const previousIds = currentIds(type);
		const previousWebsiteKindOverrides = websiteKindOverrides;
		const previousProjectHiddenOverrides = projectHiddenOverrides;
		const orderChanged = !sameOrder(previousIds, nextIds);
		const groupChanged =
			(type === 'websites' && !sameRecord(websiteKindById(), nextWebsiteKinds)) ||
			(type === 'projects' && !sameRecord(projectHiddenById(), nextProjectHidden));
		if (!orderChanged && !groupChanged) {
			clearDraft(type);
			return;
		}

		setOrder(type, nextIds);
		if (type === 'websites') websiteKindOverrides = nextWebsiteKinds;
		if (type === 'projects') projectHiddenOverrides = nextProjectHidden;
		savingReorder = type;
		try {
			const response = await fetch('/admin/api/reorder', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(reorderBody(type, nextIds, nextWebsiteKinds, nextProjectHidden))
			});

			if (!response.ok) throw new Error('Reorder failed');
		} catch {
			setOrder(type, previousIds);
			websiteKindOverrides = previousWebsiteKindOverrides;
			projectHiddenOverrides = previousProjectHiddenOverrides;
			toast.error('Order could not be saved. The previous order was restored.', {
				id: toastIds.reorder
			});
		} finally {
			clearDraft(type);
			savingReorder = null;
		}
	}

	function updateWebsiteDraft(group: WebsiteKind, items: AdminSortItem[]): WebsiteZones {
		const next = replaceZone(websiteDraft ?? websiteZones, group, items);
		websiteDraft = next;
		return next;
	}

	function updateProjectDraft(group: ProjectGroup, items: AdminSortItem[]): ProjectZones {
		const next = replaceZone(projectDraft ?? projectZones, group, items);
		projectDraft = next;
		return next;
	}

	function commitWebsites(zones: WebsiteZones) {
		void persistReorder(
			'websites',
			flattenZoneIds(zones, websiteGroupOrder),
			groupValueById(zones, { personal: 'personal', third_party: 'third_party' })
		);
	}

	function commitProjects(zones: ProjectZones) {
		void persistReorder(
			'projects',
			flattenZoneIds(zones, projectGroupOrder),
			websiteKindById(),
			groupValueById(zones, { active: false, inactive: true })
		);
	}

	function handleWebsiteConsider(group: WebsiteKind, event: SortEvent) {
		const zones = updateWebsiteDraft(group, event.detail.items);
		const { source, trigger } = event.detail.info;
		if (trigger === TRIGGERS.DRAG_STARTED) toast.dismiss(toastIds.reorder);
		if (source === SOURCES.KEYBOARD && trigger === TRIGGERS.DRAG_STOPPED) {
			commitWebsites(zones);
		}
	}

	function handleWebsiteFinalize(group: WebsiteKind, event: SortEvent) {
		const zones = updateWebsiteDraft(group, event.detail.items);
		const { source, trigger } = event.detail.info;
		if (source !== SOURCES.POINTER) return;
		if (trigger === TRIGGERS.DROPPED_OUTSIDE_OF_ANY) {
			websiteDraft = null;
		} else if (trigger === TRIGGERS.DROPPED_INTO_ZONE) {
			commitWebsites(zones);
		}
	}

	function handleProjectConsider(group: ProjectGroup, event: SortEvent) {
		const zones = updateProjectDraft(group, event.detail.items);
		const { source, trigger } = event.detail.info;
		if (trigger === TRIGGERS.DRAG_STARTED) toast.dismiss(toastIds.reorder);
		if (source === SOURCES.KEYBOARD && trigger === TRIGGERS.DRAG_STOPPED) {
			commitProjects(zones);
		}
	}

	function handleProjectFinalize(group: ProjectGroup, event: SortEvent) {
		const zones = updateProjectDraft(group, event.detail.items);
		const { source, trigger } = event.detail.info;
		if (source !== SOURCES.POINTER) return;
		if (trigger === TRIGGERS.DROPPED_OUTSIDE_OF_ANY) {
			projectDraft = null;
		} else if (trigger === TRIGGERS.DROPPED_INTO_ZONE) {
			commitProjects(zones);
		}
	}

	function handleCityConsider(event: SortEvent) {
		cityDraft = [...event.detail.items];
		const { source, trigger } = event.detail.info;
		if (trigger === TRIGGERS.DRAG_STARTED) toast.dismiss(toastIds.reorder);
		if (source === SOURCES.KEYBOARD && trigger === TRIGGERS.DRAG_STOPPED) {
			void persistReorder('cities', flattenZoneIds({ cities: cityDraft }, ['cities']));
		}
	}

	function handleCityFinalize(event: SortEvent) {
		cityDraft = [...event.detail.items];
		const { source, trigger } = event.detail.info;
		if (source !== SOURCES.POINTER) return;
		if (trigger === TRIGGERS.DROPPED_OUTSIDE_OF_ANY) {
			cityDraft = null;
		} else if (trigger === TRIGGERS.DROPPED_INTO_ZONE) {
			void persistReorder('cities', flattenZoneIds({ cities: cityDraft }, ['cities']));
		}
	}

	function handleMarketConsider(event: SortEvent) {
		marketDraft = [...event.detail.items];
		const { source, trigger } = event.detail.info;
		if (trigger === TRIGGERS.DRAG_STARTED) toast.dismiss(toastIds.reorder);
		if (source === SOURCES.KEYBOARD && trigger === TRIGGERS.DRAG_STOPPED) {
			void persistReorder('markets', flattenZoneIds({ markets: marketDraft }, ['markets']));
		}
	}

	function handleMarketFinalize(event: SortEvent) {
		marketDraft = [...event.detail.items];
		const { source, trigger } = event.detail.info;
		if (source !== SOURCES.POINTER) return;
		if (trigger === TRIGGERS.DROPPED_OUTSIDE_OF_ANY) {
			marketDraft = null;
		} else if (trigger === TRIGGERS.DROPPED_INTO_ZONE) {
			void persistReorder('markets', flattenZoneIds({ markets: marketDraft }, ['markets']));
		}
	}
</script>

<svelte:head><title>Admin · Hub</title></svelte:head>

<div class="bg-background text-foreground min-h-screen">
	<header class="border-b">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
			<div class="flex items-center gap-3">
				<a
					href={resolve('/')}
					class={buttonVariants({ variant: 'ghost', size: 'icon' })}
					aria-label="Back to hub"
				>
					<ArrowLeft class="size-4" />
				</a>
				<h1 class="text-lg font-semibold">Hub admin</h1>
			</div>
			<form method="POST" action="?/logout" use:enhance>
				<Button type="submit" variant="outline" size="sm">
					<LogOut class="size-4" /> Logout
				</Button>
			</form>
		</div>
	</header>

	<main class="mx-auto max-w-5xl px-4 py-6">
		<Tabs.Root value={activeTab} onValueChange={setActiveTab}>
			<Tabs.List>
				<Tabs.Trigger value="websites">Websites ({data.websites.length})</Tabs.Trigger>
				<Tabs.Trigger value="projects">Projects ({data.projects.length})</Tabs.Trigger>
				<Tabs.Trigger value="cities">Cities ({data.cities.length})</Tabs.Trigger>
				<Tabs.Trigger value="markets">Markets ({data.markets.length})</Tabs.Trigger>
			</Tabs.List>

			<!-- Websites -->
			<Tabs.Content value="websites" class="space-y-3">
				<div class="flex items-center justify-end gap-3">
					<form
						method="POST"
						action="?/refreshFavicons"
						use:enhance={() => {
							refreshingFavicons = true;
							toast.dismiss(toastIds.faviconRefresh);
							return async ({ result, update }) => {
								try {
									if (result.type === 'success') {
										const refreshed = (result.data?.refreshed as number | undefined) ?? 0;
										const failed = (result.data?.failed as { title: string }[] | undefined) ?? [];
										const message = `Refreshed ${refreshed} icons${failed.length ? `; ${failed.length} failed.` : '.'}`;
										if (failed.length === 0) {
											toast.success(message, { id: toastIds.faviconRefresh });
										} else {
											toast.warning(message, {
												id: toastIds.faviconRefresh,
												description: `${failed.length === 1 ? 'Failed website' : 'Failed websites'}: ${failed.map((site) => site.title).join(', ')}`,
												duration: 8000
											});
										}
									} else {
										toast.error('Icon refresh failed.', { id: toastIds.faviconRefresh });
									}
									await update();
								} finally {
									refreshingFavicons = false;
								}
							};
						}}
					>
						<Button type="submit" variant="outline" size="sm" disabled={refreshingFavicons}>
							<RefreshCw class={['size-4', refreshingFavicons && 'animate-spin']} />
							{refreshingFavicons ? 'Refreshing…' : 'Refresh icons'}
						</Button>
					</form>
					<a href={resolve('/admin/websites')} class={buttonVariants({ size: 'sm' })}>
						<Plus class="size-4" /> Add website
					</a>
				</div>
				<div class="space-y-5">
					{#each websiteGroups as group (group.id)}
						<section class="space-y-3" aria-labelledby={`websites-${group.id}`}>
							<h2
								id={`websites-${group.id}`}
								class="text-muted-foreground text-sm font-semibold tracking-wide uppercase"
							>
								{group.title}
							</h2>
							<AdminSortableList
								items={websiteZones[group.id]}
								label={group.title}
								zoneType="admin-websites"
								disabled={savingReorder === 'websites'}
								emptyLabel={group.emptyLabel}
								onConsider={(event) => handleWebsiteConsider(group.id, event)}
								onFinalize={(event) => handleWebsiteFinalize(group.id, event)}
							>
								{#snippet row(item)}
									{@const site = websiteById.get(item.rowId)}
									{#if site}
										<div class="min-w-0 flex-1">
											<div class="font-medium">{site.title}</div>
											<div class="text-muted-foreground truncate text-sm">{site.url}</div>
										</div>
										<form method="POST" action="?/toggleWebsiteHidden" use:enhance>
											<input type="hidden" name="id" value={site.id} />
											<input type="hidden" name="hidden" value={(!site.hidden).toString()} />
											<Button
												type="submit"
												variant="ghost"
												size="icon"
												aria-label={site.hidden ? 'Show' : 'Hide'}
											>
												{#if site.hidden}<EyeOff class="size-4" />{:else}<Eye class="size-4" />{/if}
											</Button>
										</form>
										<a
											href={resolve(`/admin/websites/${site.id}`)}
											class={buttonVariants({ variant: 'ghost', size: 'icon' })}
											aria-label="Edit"
										>
											<Pencil class="size-4" />
										</a>
										<form method="POST" action="?/deleteWebsite" use:enhance>
											<input type="hidden" name="id" value={site.id} />
											<Button type="submit" variant="ghost" size="icon" aria-label="Delete">
												<Trash2 class="text-destructive size-4" />
											</Button>
										</form>
									{/if}
								{/snippet}
							</AdminSortableList>
						</section>
					{/each}
				</div>
			</Tabs.Content>

			<!-- Projects -->
			<Tabs.Content value="projects" class="space-y-3">
				<div class="flex items-center justify-end gap-3">
					<form
						method="POST"
						action="?/setAllProjectsHidden"
						use:enhance={() => {
							return async ({ update }) => {
								await update();
								clearProjectOverrides();
							};
						}}
					>
						<input type="hidden" name="hidden" value={(!allHidden).toString()} />
						<Button type="submit" variant="outline" size="sm">
							{#if allHidden}
								<Eye class="size-4" /> Show all projects
							{:else}
								<EyeOff class="size-4" /> Hide all projects
							{/if}
						</Button>
					</form>
					<form
						method="POST"
						action="?/syncNow"
						use:enhance={() => {
							syncing = true;
							toast.dismiss(toastIds.projectSync);
							return async ({ result, update }) => {
								try {
									if (result.type === 'success') {
										const synced = (result.data?.synced as number | undefined) ?? 0;
										toast.success(`Synced ${synced} projects.`, {
											id: toastIds.projectSync
										});
									} else {
										toast.error('Sync failed. Check server logs.', {
											id: toastIds.projectSync
										});
									}
									await update();
								} finally {
									syncing = false;
								}
							};
						}}
					>
						<Button type="submit" size="sm" disabled={syncing}>
							<RefreshCw class={['size-4', syncing && 'animate-spin']} />
							{syncing ? 'Syncing…' : 'Sync now'}
						</Button>
					</form>
				</div>
				<div class="space-y-5">
					{#each projectGroups as group (group.id)}
						<section class="space-y-3" aria-labelledby={`projects-${group.id}`}>
							<h2
								id={`projects-${group.id}`}
								class="text-muted-foreground text-sm font-semibold tracking-wide uppercase"
							>
								{group.title}
							</h2>
							<AdminSortableList
								items={projectZones[group.id]}
								label={group.title}
								zoneType="admin-projects"
								disabled={savingReorder === 'projects'}
								emptyLabel={group.emptyLabel}
								onConsider={(event) => handleProjectConsider(group.id, event)}
								onFinalize={(event) => handleProjectFinalize(group.id, event)}
							>
								{#snippet row(item)}
									{@const project = projectById.get(item.rowId)}
									{#if project}
										<div class="min-w-0 flex-1">
											<div class="flex items-center gap-2 font-medium">
												{project.name}
												<span class="text-muted-foreground inline-flex items-center gap-1 text-xs">
													<Star class="size-3" />{project.stars}
												</span>
												{#if project.language}<Badge variant="secondary">{project.language}</Badge
													>{/if}
											</div>
											<div class="text-muted-foreground truncate text-sm">
												{project.descriptionOverride ?? project.description ?? '—'}
											</div>
										</div>
										<form
											method="POST"
											action="?/toggleProjectHidden"
											use:enhance={() => {
												return async ({ update }) => {
													await update();
													clearProjectOverrides();
												};
											}}
										>
											<input type="hidden" name="id" value={project.id} />
											<input type="hidden" name="hidden" value={(!project.hidden).toString()} />
											<Button
												type="submit"
												variant="ghost"
												size="icon"
												aria-label={project.hidden ? 'Show' : 'Hide'}
											>
												{#if project.hidden}<EyeOff class="size-4" />{:else}<Eye
														class="size-4"
													/>{/if}
											</Button>
										</form>
										<a
											href={resolve(`/admin/projects/${project.id}`)}
											class={buttonVariants({ variant: 'ghost', size: 'icon' })}
											aria-label="Edit"
										>
											<Pencil class="size-4" />
										</a>
									{/if}
								{/snippet}
							</AdminSortableList>
						</section>
					{/each}
				</div>
			</Tabs.Content>

			<!-- Cities -->
			<Tabs.Content value="cities" class="space-y-3">
				<div class="flex justify-end">
					<a href={resolve('/admin/cities')} class={buttonVariants({ size: 'sm' })}>
						<Plus class="size-4" /> Add city
					</a>
				</div>
				<AdminSortableList
					items={cityItems}
					label="Cities"
					zoneType="admin-cities"
					disabled={savingReorder === 'cities'}
					emptyLabel="No cities yet"
					onConsider={handleCityConsider}
					onFinalize={handleCityFinalize}
				>
					{#snippet row(item)}
						{@const c = cityById.get(item.rowId)}
						{#if c}
							<div class="min-w-0 flex-1">
								<div class="font-medium">{c.name}</div>
								<div class="text-muted-foreground truncate text-sm">
									{c.timezone} · {c.latitude}, {c.longitude}
								</div>
							</div>
							<form method="POST" action="?/toggleCityHidden" use:enhance>
								<input type="hidden" name="id" value={c.id} />
								<input type="hidden" name="hidden" value={(!c.hidden).toString()} />
								<Button
									type="submit"
									variant="ghost"
									size="icon"
									aria-label={c.hidden ? 'Show' : 'Hide'}
								>
									{#if c.hidden}<EyeOff class="size-4" />{:else}<Eye class="size-4" />{/if}
								</Button>
							</form>
							<a
								href={resolve(`/admin/cities/${c.id}`)}
								class={buttonVariants({ variant: 'ghost', size: 'icon' })}
								aria-label="Edit"
							>
								<Pencil class="size-4" />
							</a>
							<form method="POST" action="?/deleteCity" use:enhance>
								<input type="hidden" name="id" value={c.id} />
								<Button type="submit" variant="ghost" size="icon" aria-label="Delete">
									<Trash2 class="text-destructive size-4" />
								</Button>
							</form>
						{/if}
					{/snippet}
				</AdminSortableList>
			</Tabs.Content>

			<!-- Markets -->
			<Tabs.Content value="markets" class="space-y-3">
				<div class="flex items-center justify-end gap-3">
					<form
						method="POST"
						action="?/importSupportedMarkets"
						use:enhance={() => {
							importingMarkets = true;
							toast.dismiss(toastIds.marketImport);
							return async ({ result, update }) => {
								try {
									if (result.type === 'success') {
										const imported = (result.data?.imported as number | undefined) ?? 0;
										if (imported === 0) {
											toast.info('All canonical markets are already configured.', {
												id: toastIds.marketImport
											});
										} else {
											toast.success(`Imported ${imported} canonical markets.`, {
												id: toastIds.marketImport
											});
										}
									} else {
										toast.error('Market import failed. Check server logs.', {
											id: toastIds.marketImport
										});
									}
									await update();
								} finally {
									importingMarkets = false;
								}
							};
						}}
					>
						<Button type="submit" variant="outline" size="sm" disabled={importingMarkets}>
							<RefreshCw class={['size-4', importingMarkets && 'animate-spin']} />
							{importingMarkets ? 'Importing…' : 'Import all canonical markets'}
						</Button>
					</form>
					<a href={resolve('/admin/markets')} class={buttonVariants({ size: 'sm' })}>
						<Plus class="size-4" /> Add market
					</a>
				</div>
				<AdminSortableList
					items={marketItems}
					label="Markets"
					zoneType="admin-markets"
					disabled={savingReorder === 'markets'}
					emptyLabel="No markets configured"
					onConsider={handleMarketConsider}
					onFinalize={handleMarketFinalize}
				>
					{#snippet row(item)}
						{@const market = marketById.get(item.rowId)}
						{#if market}
							<div class="min-w-0 flex-1">
								<div class="font-medium">{market.market.title}</div>
								<div class="text-muted-foreground truncate text-sm">
									{market.market.city}, {market.market.country}
								</div>
							</div>
							<form method="POST" action="?/toggleMarketHidden" use:enhance>
								<input type="hidden" name="id" value={market.id} />
								<input type="hidden" name="hidden" value={(!market.hidden).toString()} />
								<Button
									type="submit"
									variant="ghost"
									size="icon"
									aria-label={market.hidden ? 'Show' : 'Hide'}
								>
									{#if market.hidden}<EyeOff class="size-4" />{:else}<Eye class="size-4" />{/if}
								</Button>
							</form>
							<a
								href={resolve(`/admin/markets/${market.id}`)}
								class={buttonVariants({ variant: 'ghost', size: 'icon' })}
								aria-label="Edit"
							>
								<Pencil class="size-4" />
							</a>
							<form method="POST" action="?/deleteMarket" use:enhance>
								<input type="hidden" name="id" value={market.id} />
								<Button type="submit" variant="ghost" size="icon" aria-label="Delete">
									<Trash2 class="text-destructive size-4" />
								</Button>
							</form>
						{/if}
					{/snippet}
				</AdminSortableList>
			</Tabs.Content>
		</Tabs.Root>
	</main>
</div>

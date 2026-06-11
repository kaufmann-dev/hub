<script lang="ts">
	import { enhance } from '$app/forms';
	import { replaceState } from '$app/navigation';
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
		ArrowLeft,
		GripVertical
	} from '@lucide/svelte';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Tabs from '$lib/components/ui/tabs';
	import type { PageData } from './$types';

	type AdminTab = 'websites' | 'projects' | 'cities';
	type Row = { id: number };

	const adminTabs = ['websites', 'projects', 'cities'] as const;

	let { data }: { data: PageData } = $props();
	let syncing = $state(false);
	let syncStatus = $state<{ ok: boolean; message: string } | null>(null);
	let reorderError = $state('');
	let savingReorder = $state<AdminTab | null>(null);
	let dragging = $state<{ type: AdminTab; id: number } | null>(null);
	let websiteOrder = $state.raw<number[] | null>(null);
	let projectOrder = $state.raw<number[] | null>(null);
	let cityOrder = $state.raw<number[] | null>(null);
	let allHidden = $derived(data.projects.every((p) => p.hidden));
	let activeTab = $derived(normalizeTab(page.url.searchParams.get('tab')));
	let displayedWebsites = $derived(orderedRows(data.websites, websiteOrder));
	let displayedProjects = $derived(orderedRows(data.projects, projectOrder));
	let displayedCities = $derived(orderedRows(data.cities, cityOrder));

	function normalizeTab(tab: string | null): AdminTab {
		return adminTabs.includes(tab as AdminTab) ? (tab as AdminTab) : 'websites';
	}

	function setActiveTab(tab: string) {
		const nextTab = normalizeTab(tab);
		const url = new URL(page.url);
		url.searchParams.set('tab', nextTab);
		replaceState(url, page.state);
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

	function currentIds(type: AdminTab): number[] {
		if (type === 'websites') return displayedWebsites.map((row) => row.id);
		if (type === 'projects') return displayedProjects.map((row) => row.id);
		return displayedCities.map((row) => row.id);
	}

	function setOrder(type: AdminTab, ids: number[] | null) {
		if (type === 'websites') {
			websiteOrder = ids;
		} else if (type === 'projects') {
			projectOrder = ids;
		} else {
			cityOrder = ids;
		}
	}

	function movedIds(
		ids: number[],
		sourceId: number,
		targetId: number,
		afterTarget: boolean
	): number[] {
		const withoutSource = ids.filter((id) => id !== sourceId);
		const targetIndex = withoutSource.indexOf(targetId);
		if (targetIndex === -1) return ids;

		const insertIndex = targetIndex + (afterTarget ? 1 : 0);
		return [...withoutSource.slice(0, insertIndex), sourceId, ...withoutSource.slice(insertIndex)];
	}

	function handleDragStart(type: AdminTab, id: number, event: DragEvent) {
		dragging = { type, id };
		reorderError = '';
		event.dataTransfer?.setData('text/plain', String(id));
		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
	}

	async function handleDrop(type: AdminTab, targetId: number, event: DragEvent) {
		event.preventDefault();
		const sourceId =
			dragging?.type === type ? dragging.id : Number(event.dataTransfer?.getData('text/plain'));
		dragging = null;

		if (!Number.isInteger(sourceId) || sourceId === targetId) return;

		const target = event.currentTarget;
		if (!(target instanceof HTMLElement)) return;

		const bounds = target.getBoundingClientRect();
		const afterTarget = event.clientY > bounds.top + bounds.height / 2;
		const previousIds = currentIds(type);
		const nextIds = movedIds(previousIds, sourceId, targetId, afterTarget);
		if (nextIds.join(',') === previousIds.join(',')) return;

		setOrder(type, nextIds);
		savingReorder = type;
		try {
			const response = await fetch('/admin/api/reorder', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ type, ids: nextIds })
			});

			if (!response.ok) throw new Error('Reorder failed');
		} catch {
			setOrder(type, previousIds);
			reorderError = 'Order could not be saved.';
		} finally {
			savingReorder = null;
		}
	}
</script>

<svelte:head><title>Admin · Hub</title></svelte:head>

<div class="bg-background text-foreground min-h-screen">
	<header class="border-b">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
			<div class="flex items-center gap-3">
				<a
					href="/"
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
			</Tabs.List>

			<!-- Websites -->
			<Tabs.Content value="websites" class="space-y-3">
				<div class="flex justify-end">
					<a href="/admin/websites" class={buttonVariants({ size: 'sm' })}>
						<Plus class="size-4" /> Add website
					</a>
				</div>
				{#if reorderError && activeTab === 'websites'}
					<p class="text-destructive text-sm">{reorderError}</p>
				{/if}
				<div class="space-y-3" role="list" aria-label="Websites">
					{#each displayedWebsites as site (site.id)}
						<div
							class="bg-card flex items-center gap-3 rounded-lg border p-3"
							role="listitem"
							ondragover={handleDragOver}
							ondrop={(event) => handleDrop('websites', site.id, event)}
						>
							<button
								type="button"
								class="text-muted-foreground hover:text-foreground cursor-grab rounded-md p-1 active:cursor-grabbing"
								draggable="true"
								aria-label={`Drag ${site.title}`}
								disabled={savingReorder === 'websites'}
								ondragstart={(event) => handleDragStart('websites', site.id, event)}
								ondragend={() => (dragging = null)}
							>
								<GripVertical class="size-4" />
							</button>
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2 font-medium">
									{site.title}
									<Badge variant="secondary">{site.kind}</Badge>
								</div>
								<div class="text-muted-foreground truncate text-sm">{site.url}</div>
							</div>
							<a
								href={`/admin/websites/${site.id}`}
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
						</div>
					{:else}
						<p class="text-muted-foreground text-sm">No websites yet.</p>
					{/each}
				</div>
			</Tabs.Content>

			<!-- Projects -->
			<Tabs.Content value="projects" class="space-y-3">
				<div class="flex items-center justify-end gap-3">
					{#if syncStatus}
						<span class={['text-sm', syncStatus.ok ? 'text-muted-foreground' : 'text-destructive']}>
							{syncStatus.message}
						</span>
					{/if}
					<form method="POST" action="?/setAllProjectsHidden" use:enhance>
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
							syncStatus = null;
							return async ({ result, update }) => {
								if (result.type === 'success') {
									const synced = (result.data?.synced as number | undefined) ?? 0;
									syncStatus = { ok: true, message: `Synced ${synced} projects.` };
								} else if (result.type === 'failure') {
									syncStatus = { ok: false, message: 'Sync failed. Check server logs.' };
								}
								await update();
								syncing = false;
							};
						}}
					>
						<Button type="submit" size="sm" disabled={syncing}>
							<RefreshCw class={['size-4', syncing && 'animate-spin']} />
							{syncing ? 'Syncing…' : 'Sync now'}
						</Button>
					</form>
				</div>
				{#if reorderError && activeTab === 'projects'}
					<p class="text-destructive text-sm">{reorderError}</p>
				{/if}
				<div class="space-y-3" role="list" aria-label="Projects">
					{#each displayedProjects as project (project.id)}
						<div
							class={[
								'bg-card flex items-center gap-3 rounded-lg border p-3',
								project.hidden && 'opacity-50'
							]}
							role="listitem"
							ondragover={handleDragOver}
							ondrop={(event) => handleDrop('projects', project.id, event)}
						>
							<button
								type="button"
								class="text-muted-foreground hover:text-foreground cursor-grab rounded-md p-1 active:cursor-grabbing"
								draggable="true"
								aria-label={`Drag ${project.name}`}
								disabled={savingReorder === 'projects'}
								ondragstart={(event) => handleDragStart('projects', project.id, event)}
								ondragend={() => (dragging = null)}
							>
								<GripVertical class="size-4" />
							</button>
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2 font-medium">
									{project.name}
									<span class="text-muted-foreground inline-flex items-center gap-1 text-xs">
										<Star class="size-3" />{project.stars}
									</span>
									{#if project.language}<Badge variant="secondary">{project.language}</Badge>{/if}
								</div>
								<div class="text-muted-foreground truncate text-sm">
									{project.descriptionOverride ?? project.description ?? '—'}
								</div>
							</div>
							<form method="POST" action="?/toggleProjectHidden" use:enhance>
								<input type="hidden" name="id" value={project.id} />
								<input type="hidden" name="hidden" value={(!project.hidden).toString()} />
								<Button
									type="submit"
									variant="ghost"
									size="icon"
									aria-label={project.hidden ? 'Show' : 'Hide'}
								>
									{#if project.hidden}<EyeOff class="size-4" />{:else}<Eye class="size-4" />{/if}
								</Button>
							</form>
							<a
								href={`/admin/projects/${project.id}`}
								class={buttonVariants({ variant: 'ghost', size: 'icon' })}
								aria-label="Edit"
							>
								<Pencil class="size-4" />
							</a>
						</div>
					{:else}
						<p class="text-muted-foreground text-sm">No projects synced yet. Click “Sync now”.</p>
					{/each}
				</div>
			</Tabs.Content>

			<!-- Cities -->
			<Tabs.Content value="cities" class="space-y-3">
				<div class="flex justify-end">
					<a href="/admin/cities" class={buttonVariants({ size: 'sm' })}>
						<Plus class="size-4" /> Add city
					</a>
				</div>
				{#if reorderError && activeTab === 'cities'}
					<p class="text-destructive text-sm">{reorderError}</p>
				{/if}
				<div class="space-y-3" role="list" aria-label="Cities">
					{#each displayedCities as c (c.id)}
						<div
							class="bg-card flex items-center gap-3 rounded-lg border p-3"
							role="listitem"
							ondragover={handleDragOver}
							ondrop={(event) => handleDrop('cities', c.id, event)}
						>
							<button
								type="button"
								class="text-muted-foreground hover:text-foreground cursor-grab rounded-md p-1 active:cursor-grabbing"
								draggable="true"
								aria-label={`Drag ${c.name}`}
								disabled={savingReorder === 'cities'}
								ondragstart={(event) => handleDragStart('cities', c.id, event)}
								ondragend={() => (dragging = null)}
							>
								<GripVertical class="size-4" />
							</button>
							<div class="min-w-0 flex-1">
								<div class="font-medium">{c.name}</div>
								<div class="text-muted-foreground truncate text-sm">
									{c.timezone} · {c.latitude}, {c.longitude}
								</div>
							</div>
							<a
								href={`/admin/cities/${c.id}`}
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
						</div>
					{:else}
						<p class="text-muted-foreground text-sm">No cities yet.</p>
					{/each}
				</div>
			</Tabs.Content>
		</Tabs.Root>
	</main>
</div>

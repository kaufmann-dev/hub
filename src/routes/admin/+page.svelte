<script lang="ts">
	import { enhance } from '$app/forms';
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
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Tabs from '$lib/components/ui/tabs';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let syncing = $state(false);
	let syncStatus = $state<{ ok: boolean; message: string } | null>(null);
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
		<Tabs.Root value="websites">
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
				{#each data.websites as site (site.id)}
					<div class="bg-card flex items-center gap-3 rounded-lg border p-3">
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
			</Tabs.Content>

			<!-- Projects -->
			<Tabs.Content value="projects" class="space-y-3">
				<div class="flex items-center justify-end gap-3">
					{#if syncStatus}
						<span class={['text-sm', syncStatus.ok ? 'text-muted-foreground' : 'text-destructive']}>
							{syncStatus.message}
						</span>
					{/if}
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
				{#each data.projects as project (project.id)}
					<div
						class="bg-card flex items-center gap-3 rounded-lg border p-3"
						class:opacity-50={project.hidden}
					>
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
			</Tabs.Content>

			<!-- Cities -->
			<Tabs.Content value="cities" class="space-y-3">
				<div class="flex justify-end">
					<a href="/admin/cities" class={buttonVariants({ size: 'sm' })}>
						<Plus class="size-4" /> Add city
					</a>
				</div>
				{#each data.cities as c (c.id)}
					<div class="bg-card flex items-center gap-3 rounded-lg border p-3">
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
			</Tabs.Content>
		</Tabs.Root>
	</main>
</div>

<script lang="ts">
	import { Search, Star, ExternalLink, Settings, Sun, Moon, ScrollText } from '@lucide/svelte';
	import { toggleMode } from 'mode-watcher';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { clock } from '$lib/clock.svelte';
	import { faviconFor } from '$lib/favicon';
	import WeatherIcon from '$lib/components/hub/WeatherIcon.svelte';
	import GithubMark from '$lib/components/hub/GithubMark.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let q = $state('');
	let filterInput = $state<HTMLInputElement | null>(null);

	const needle = $derived(q.trim().toLowerCase());

	function matches(...fields: (string | null | undefined)[]): boolean {
		if (!needle) return true;
		return fields.some((f) => f?.toLowerCase().includes(needle));
	}

	const filteredWebsites = $derived(
		data.websites.filter((w) => matches(w.title, w.description, w.url, w.imprintSite))
	);
	const filteredProjects = $derived(
		data.projects.filter((p) =>
			matches(p.name, p.descriptionOverride ?? p.description, p.language, p.fullName)
		)
	);

	// "/" focuses the filter unless the user is already typing in a field.
	function onKeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement | null;
		const typing = target && ['INPUT', 'TEXTAREA'].includes(target.tagName);
		if (e.key === '/' && !typing) {
			e.preventDefault();
			filterInput?.focus();
		}
	}

	function timeIn(tz: string): string {
		return new Intl.DateTimeFormat('en-GB', {
			timeZone: tz,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		}).format(clock.now);
	}

	function dateIn(tz: string): string {
		return new Intl.DateTimeFormat('en-GB', {
			timeZone: tz,
			weekday: 'short',
			day: 'numeric',
			month: 'short'
		}).format(clock.now);
	}
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head>
	<title>Hub</title>
	<meta name="description" content="Personal hub: websites, GitHub projects, clocks and weather." />
</svelte:head>

<div class="bg-background text-foreground min-h-screen">
	<!-- Filter bar (sticky, top) -->
	<header class="bg-background/80 sticky top-0 z-20 border-b backdrop-blur">
		<div class="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
			<div class="relative flex-1">
				<Search
					class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
				/>
				<Input
					bind:ref={filterInput}
					bind:value={q}
					placeholder="Filter websites and projects…  (press /)"
					class="pl-9"
					aria-label="Filter"
				/>
			</div>
			<Button variant="ghost" size="icon" onclick={toggleMode} aria-label="Toggle theme">
				<Sun class="size-4 dark:hidden" />
				<Moon class="hidden size-4 dark:block" />
			</Button>
			<Button variant="outline" size="sm" href="/admin">
				<Settings class="size-4" />
				<span class="hidden sm:inline">Admin</span>
			</Button>
		</div>
	</header>

	<main class="mx-auto max-w-6xl space-y-10 px-4 py-8">
		<!-- City clocks + weather -->
		{#if data.cities.length}
			<section class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.cities as city (city.id)}
					{@const weather = data.weatherByCity[city.id]}
					<div
						class="bg-card text-card-foreground flex items-center justify-between rounded-xl border p-5"
					>
						<div>
							<div class="text-muted-foreground text-sm font-medium">{city.name}</div>
							<div class="font-mono text-3xl tabular-nums">{timeIn(city.timezone)}</div>
							<div class="text-muted-foreground text-xs">{dateIn(city.timezone)}</div>
						</div>
						{#if weather}
							<div class="flex flex-col items-center">
								<WeatherIcon icon={weather.icon} class="text-muted-foreground size-7" />
								<div class="mt-1 text-xl font-semibold">{weather.temperature}{weather.unit}</div>
								<div class="text-muted-foreground text-xs">{weather.label}</div>
							</div>
						{/if}
					</div>
				{/each}
			</section>
		{/if}

		<!-- Websites -->
		<section>
			<h2 class="text-muted-foreground mb-3 text-sm font-semibold tracking-wide uppercase">
				Websites
			</h2>
			{#if filteredWebsites.length}
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each filteredWebsites as site (site.id)}
						{@const favicon = faviconFor(site.url, site.iconUrl)}
						<div
							class="group bg-card text-card-foreground hover:border-primary/50 relative flex flex-col rounded-xl border p-4 transition-colors"
						>
							<a
								href={site.url}
								target="_blank"
								rel="noopener noreferrer"
								class="flex items-start gap-3"
							>
								{#if favicon}
									<img src={favicon} alt="" class="mt-0.5 size-6 shrink-0 rounded" loading="lazy" />
								{:else}
									<ExternalLink class="text-muted-foreground mt-0.5 size-6 shrink-0" />
								{/if}
								<span class="min-w-0 flex-1">
									<span class="flex items-center gap-1.5 font-medium">
										{site.title}
										<ExternalLink
											class="text-muted-foreground size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
										/>
									</span>
									{#if site.description}
										<span class="text-muted-foreground line-clamp-2 text-sm"
											>{site.description}</span
										>
									{/if}
								</span>
							</a>
							{#if site.imprintSite}
								<a
									href={`https://legal.kaufmann.dev/imprint?site=${encodeURIComponent(site.imprintSite)}`}
									target="_blank"
									rel="noopener noreferrer"
									class="text-muted-foreground hover:text-foreground mt-2 inline-flex w-fit items-center gap-1 text-xs"
								>
									<ScrollText class="size-3" /> Imprint
								</a>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-muted-foreground text-sm">No websites match “{q}”.</p>
			{/if}
		</section>

		<!-- GitHub projects -->
		<section>
			<h2 class="text-muted-foreground mb-3 text-sm font-semibold tracking-wide uppercase">
				GitHub projects
			</h2>
			{#if filteredProjects.length}
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each filteredProjects as project (project.id)}
						<div
							class="group bg-card text-card-foreground hover:border-primary/50 flex flex-col rounded-xl border p-4 transition-colors"
						>
							<a
								href={project.url}
								target="_blank"
								rel="noopener noreferrer"
								class="flex items-center gap-2 font-medium"
							>
								<GithubMark class="size-4 shrink-0" />
								<span class="truncate">{project.name}</span>
							</a>
							{#if project.descriptionOverride ?? project.description}
								<p class="text-muted-foreground mt-1 line-clamp-2 flex-1 text-sm">
									{project.descriptionOverride ?? project.description}
								</p>
							{/if}
							<div class="text-muted-foreground mt-3 flex items-center gap-3 text-xs">
								{#if project.language}
									<span>{project.language}</span>
								{/if}
								<span class="inline-flex items-center gap-1">
									<Star class="size-3" />
									{project.stars}
								</span>
								{#if project.homepage}
									<a
										href={project.homepage}
										target="_blank"
										rel="noopener noreferrer"
										class="hover:text-foreground ml-auto inline-flex items-center gap-1"
									>
										<ExternalLink class="size-3" /> Site
									</a>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{:else if data.projects.length}
				<p class="text-muted-foreground text-sm">No projects match “{q}”.</p>
			{:else}
				<p class="text-muted-foreground text-sm">
					No projects synced yet. Open <a class="underline" href="/admin">Admin</a> and run a sync.
				</p>
			{/if}
		</section>
	</main>
</div>

<script lang="ts">
	import { resolve } from '$app/paths';
	import { Search, Star, ExternalLink, Settings, Sun, Moon, Landmark, Info } from '@lucide/svelte';
	import { toggleMode } from 'mode-watcher';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import * as Popover from '$lib/components/ui/popover';
	import { clock } from '$lib/clock.svelte';
	import { faviconUrls } from '$lib/favicon';
	import WeatherIcon from '$lib/components/hub/WeatherIcon.svelte';
	import GithubMark from '$lib/components/hub/GithubMark.svelte';
	import WebsiteIcon from '$lib/components/hub/WebsiteIcon.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let q = $state('');
	let filterInput = $state<HTMLInputElement | null>(null);

	// Weather is fetched server-side for the first paint, then refreshed on the
	// client so a long-open tab does not show stale conditions. The server caches
	// upstream calls (~15 min), so polling here is cheap. `refreshedWeather` holds
	// the latest client fetch and overrides the server value once available.
	let refreshedWeather = $state<PageData['weatherByCity'] | null>(null);
	const weatherByCity = $derived(refreshedWeather ?? data.weatherByCity);
	const WEATHER_REFRESH_MS = 10 * 60 * 1000;

	async function refreshWeather() {
		try {
			const res = await fetch(resolve('/api/weather'));
			if (!res.ok) return;
			const body = (await res.json()) as { weatherByCity: PageData['weatherByCity'] };
			refreshedWeather = body.weatherByCity;
		} catch {
			// Best-effort: keep the last known weather on any failure.
		}
	}

	$effect(() => {
		const interval = setInterval(refreshWeather, WEATHER_REFRESH_MS);
		// Catch up immediately when the tab becomes visible again (timers are
		// throttled or paused while backgrounded).
		const onVisible = () => {
			if (document.visibilityState === 'visible') refreshWeather();
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			clearInterval(interval);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});

	const needle = $derived(q.trim().toLowerCase());

	function matches(...fields: (string | null | undefined)[]): boolean {
		if (!needle) return true;
		return fields.some((f) => f?.toLowerCase().includes(needle));
	}

	const filteredWebsites = $derived(
		data.websites.filter((w) => matches(w.title, w.description, w.url))
	);
	const personalWebsites = $derived(filteredWebsites.filter((w) => w.kind === 'personal'));
	const thirdPartyWebsites = $derived(filteredWebsites.filter((w) => w.kind === 'third_party'));
	const websiteGroups = $derived(
		[
			{ id: 'personal' as const, title: 'Personal websites', websites: personalWebsites },
			{ id: 'third_party' as const, title: 'Third-party websites', websites: thirdPartyWebsites }
		].filter((group) => group.websites.length > 0)
	);
	const filteredProjects = $derived(
		data.projects.filter((p) =>
			matches(p.name, p.descriptionOverride ?? p.description, p.language, p.fullName)
		)
	);
	const filteredMarkets = $derived(
		data.markets.filter((m) =>
			matches(
				m.title,
				m.city,
				m.country,
				m.currentStatus,
				m.countdownLabel,
				m.hoursLabel,
				m.supplementalDetail
			)
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

	function marketStatusLabel(status: string): string {
		return status ? status[0].toUpperCase() + status.slice(1) : 'Unknown';
	}

	type MarketEntry = PageData['markets'][number];

	// The next upcoming transition fully determines the live status and countdown:
	// a pending `close` means the market is open now; a pending `open`/`reopen`
	// means it is closed. Recomputed every second via the reactive `now`.
	function nextTransition(market: MarketEntry, now: Date) {
		const t = now.getTime();
		return market.transitions?.find((transition) => transition.at > t) ?? null;
	}

	function liveStatus(market: MarketEntry, now: Date): 'open' | 'closed' {
		const next = nextTransition(market, now);
		if (!next) return market.currentStatus;
		return next.kind === 'close' ? 'open' : 'closed';
	}

	function liveCountdown(market: MarketEntry, now: Date): string {
		const next = nextTransition(market, now);
		if (!next) return market.countdownLabel;
		const prefix = next.kind === 'close' ? 'Closes' : next.kind === 'reopen' ? 'Reopens' : 'Opens';
		const totalMinutes = Math.max(0, Math.ceil((next.at - now.getTime()) / 60_000));
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		return `${prefix} in ${hours}h ${minutes.toString().padStart(2, '0')}m`;
	}

	const now = $derived(clock.now);
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head>
	<title>Hub</title>
	<meta name="description" content="Personal hub: websites, GitHub projects, clocks and weather." />
</svelte:head>

<div class="bg-background text-foreground flex min-h-screen flex-col">
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
					placeholder="Filter websites, projects and markets…  (press /)"
					class="pl-9"
					aria-label="Filter"
				/>
			</div>
			<Button variant="ghost" size="icon" onclick={toggleMode} aria-label="Toggle theme">
				<Sun class="size-4 dark:hidden" />
				<Moon class="hidden size-4 dark:block" />
			</Button>
			<Button variant="outline" size="sm" href={resolve('/admin')}>
				<Settings class="size-4" />
				<span class="hidden sm:inline">Admin</span>
			</Button>
		</div>
	</header>

	<main class="mx-auto w-full max-w-6xl flex-1 space-y-10 px-4 py-8">
		<!-- City clocks + weather -->
		{#if data.cities.length}
			<section aria-labelledby="cities">
				<h2
					id="cities"
					class="text-muted-foreground mb-3 text-sm font-semibold tracking-wide uppercase"
				>
					Cities
				</h2>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each data.cities as city (city.id)}
						{@const weather = weatherByCity[city.id]}
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
				</div>
			</section>
		{/if}

		<!-- Market status -->
		{#if filteredMarkets.length}
			<section aria-labelledby="markets">
				<h2
					id="markets"
					class="text-muted-foreground mb-3 text-sm font-semibold tracking-wide uppercase"
				>
					Markets
				</h2>
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each filteredMarkets as market (market.id)}
						{@const status = liveStatus(market, now)}
						<div class="bg-card text-card-foreground rounded-xl border p-4">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<div class="flex items-center gap-2 font-medium">
										<Landmark class="text-muted-foreground size-4 shrink-0" />
										<span class="truncate">{market.title}</span>
									</div>
									<div class="text-muted-foreground mt-1 truncate text-sm">
										{market.city}, {market.country}
									</div>
								</div>
								<div class="flex shrink-0 flex-col items-end gap-1">
									<div
										class={[
											'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium',
											status === 'open'
												? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
												: 'text-muted-foreground bg-muted/60'
										]}
									>
										<span
											class={[
												'size-1.5 rounded-full',
												status === 'open' ? 'bg-emerald-500' : 'bg-muted-foreground/60'
											]}
										></span>
										{marketStatusLabel(status)}
									</div>
									<div class="text-muted-foreground text-xs">{liveCountdown(market, now)}</div>
								</div>
							</div>
							<div
								class="text-muted-foreground mt-3 flex items-center justify-between gap-3 text-xs"
							>
								<span class="font-mono tabular-nums">{market.hoursLabel}</span>
								{#if market.supplementalDetail}
									<Popover.Root>
										<Popover.Trigger
											class="hover:text-foreground -m-2 shrink-0 rounded-full p-2"
											aria-label={`Schedule detail for ${market.title}`}
										>
											<Info class="size-3.5" />
										</Popover.Trigger>
										<Popover.Content class="w-auto max-w-72 text-xs">
											<p>{market.supplementalDetail}</p>
										</Popover.Content>
									</Popover.Root>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Websites -->
		{#if filteredWebsites.length}
			{#each websiteGroups as group (group.id)}
				<section aria-labelledby={`websites-${group.id}`}>
					<h2
						id={`websites-${group.id}`}
						class="text-muted-foreground mb-3 text-sm font-semibold tracking-wide uppercase"
					>
						{group.title}
					</h2>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{#each group.websites as site (site.id)}
							{@const favicon = faviconUrls(site.id, site.faviconCheckedAt)}
							<div
								class="group bg-card text-card-foreground hover:border-primary/50 relative flex flex-col rounded-xl border p-4 transition-colors"
							>
								<a
									href={site.url}
									target="_blank"
									rel="noopener noreferrer"
									class="flex items-start gap-3"
								>
									<WebsiteIcon lightSrc={favicon.light} darkSrc={favicon.dark} />
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
							</div>
						{/each}
					</div>
				</section>
			{/each}
		{:else}
			<section>
				<p class="text-muted-foreground text-sm">No websites match "{q}".</p>
			</section>
		{/if}

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
				<p class="text-muted-foreground text-sm">No projects match "{q}".</p>
			{:else}
				<p class="text-muted-foreground text-sm">
					No projects synced yet. Open <a class="underline" href={resolve('/admin')}>Admin</a> and run
					a sync.
				</p>
			{/if}
		</section>
	</main>

	<!-- Footer -->
	<footer class="border-t">
		<div class="mx-auto flex max-w-6xl items-center justify-center gap-4 px-4 py-6 text-sm">
			<a
				href="https://legal.kaufmann.dev/imprint?site=hub.kaufmann.dev"
				target="_blank"
				rel="noopener noreferrer"
				class="text-muted-foreground hover:text-foreground"
			>
				Imprint
			</a>
			<span class="text-muted-foreground">·</span>
			<a
				href="https://legal.kaufmann.dev/privacy?site=hub.kaufmann.dev"
				target="_blank"
				rel="noopener noreferrer"
				class="text-muted-foreground hover:text-foreground"
			>
				Privacy
			</a>
		</div>
	</footer>
</div>

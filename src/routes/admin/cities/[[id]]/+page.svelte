<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { ArrowLeft, ChevronsUpDown } from '@lucide/svelte';
	import { citySchema } from '$lib/schemas';
	import * as Form from '$lib/components/ui/form';
	import * as Command from '$lib/components/ui/command';
	import * as Popover from '$lib/components/ui/popover';
	import { Input } from '$lib/components/ui/input';
	import { buttonVariants } from '$lib/components/ui/button';
	import type { PageData } from './$types';

	type CitySuggestion = {
		id: number;
		name: string;
		country: string;
		admin1?: string;
		timezone: string;
		latitude: number;
		longitude: number;
		label: string;
	};

	let { data }: { data: PageData } = $props();

	const form = superForm(data.form, { validators: zod4Client(citySchema) });
	const { form: formData, enhance } = form;

	let open = $state(false);
	let searchQuery = $state($formData.name ?? '');
	let selectedLabel = $state($formData.name ?? '');
	let suggestions = $state.raw<CitySuggestion[]>([]);
	let searchStatus = $state<'idle' | 'loading' | 'error'>('idle');
	let searchError = $state('');
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	let searchAbortController: AbortController | undefined;
	let searchRequestId = 0;

	let hasCityDetails = $derived(
		($formData.name ?? '').trim().length > 0 &&
			($formData.timezone ?? '').trim().length > 0 &&
			Number.isFinite($formData.latitude) &&
			Number.isFinite($formData.longitude)
	);

	let triggerLabel = $derived(selectedLabel || searchQuery || 'Search city');

	function hiddenNumberValue(value: number | undefined): string {
		return Number.isFinite(value) ? String(value) : '';
	}

	function clearSelectedCity(name: string) {
		selectedLabel = '';
		$formData.name = name.trim();
		$formData.timezone = '';
		$formData.latitude = Number.NaN;
		$formData.longitude = Number.NaN;
	}

	function scheduleSearch(value: string) {
		if (searchTimer) clearTimeout(searchTimer);
		searchAbortController?.abort();
		searchRequestId += 1;

		const query = value.trim();
		if (query.length < 2) {
			suggestions = [];
			searchStatus = 'idle';
			searchError = '';
			return;
		}

		searchStatus = 'loading';
		searchError = '';
		searchTimer = setTimeout(() => {
			void searchCities(query);
		}, 200);
	}

	function handleSearchInput(event: Event) {
		const target = event.currentTarget;
		if (!(target instanceof HTMLInputElement)) return;

		searchQuery = target.value;
		if (searchQuery !== selectedLabel) {
			clearSelectedCity(searchQuery);
		}
		scheduleSearch(searchQuery);
	}

	async function searchCities(query: string) {
		const requestId = ++searchRequestId;
		searchAbortController = new AbortController();

		try {
			const response = await fetch(`/admin/api/city-search?q=${encodeURIComponent(query)}`, {
				signal: searchAbortController.signal
			});
			const payload = (await response.json()) as {
				suggestions?: CitySuggestion[];
				error?: string;
			};

			if (requestId !== searchRequestId) return;

			if (!response.ok) {
				throw new Error(payload.error ?? 'City search failed');
			}

			suggestions = payload.suggestions ?? [];
			searchStatus = 'idle';
			searchError = '';
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return;
			if (requestId !== searchRequestId) return;

			suggestions = [];
			searchStatus = 'error';
			searchError = error instanceof Error ? error.message : 'City search failed';
		}
	}

	function selectSuggestion(suggestion: CitySuggestion) {
		if (searchTimer) clearTimeout(searchTimer);
		searchAbortController?.abort();
		searchRequestId += 1;
		selectedLabel = suggestion.label;
		searchQuery = suggestion.label;
		$formData.name = suggestion.name;
		$formData.timezone = suggestion.timezone;
		$formData.latitude = suggestion.latitude;
		$formData.longitude = suggestion.longitude;
		suggestions = [];
		searchStatus = 'idle';
		searchError = '';
		open = false;
	}
</script>

<svelte:head><title>{data.isEdit ? 'Edit city' : 'Add city'} · Admin</title></svelte:head>

<div class="bg-background text-foreground min-h-screen">
	<main class="mx-auto max-w-xl px-4 py-8">
		<div class="mb-6 flex items-center gap-3">
			<a href="/admin" class={buttonVariants({ variant: 'ghost', size: 'icon' })} aria-label="Back">
				<ArrowLeft class="size-4" />
			</a>
			<h1 class="text-lg font-semibold">{data.isEdit ? 'Edit city' : 'Add city'}</h1>
		</div>

		<form method="POST" use:enhance class="space-y-4">
			<Form.Field {form} name="name">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>City</Form.Label>
						<input type="hidden" name={props.name} value={$formData.name ?? ''} />
						<Popover.Root bind:open>
							<Popover.Trigger
								id={props.id}
								class={buttonVariants({
									variant: 'outline',
									class: 'h-auto min-h-8 w-full justify-between gap-2 px-2.5 py-1.5 text-left'
								})}
								role="combobox"
								aria-expanded={open}
								aria-invalid={props['aria-invalid']}
							>
								<span class={['min-w-0 truncate', !hasCityDetails && 'text-muted-foreground']}>
									{triggerLabel}
								</span>
								<ChevronsUpDown class="text-muted-foreground size-4 shrink-0" />
							</Popover.Trigger>
							<Popover.Content align="start" class="w-[min(28rem,calc(100vw-2rem))] p-2">
								<div class="space-y-2">
									<Input
										value={searchQuery}
										placeholder="Search city..."
										aria-label="Search city"
										autocomplete="off"
										oninput={handleSearchInput}
									/>
									<Command.Root shouldFilter={false} class="rounded-2xl p-0">
										<Command.List>
											{#if searchStatus === 'loading'}
												<Command.Loading class="text-muted-foreground px-2 py-3 text-sm">
													Searching cities...
												</Command.Loading>
											{:else if searchStatus === 'error'}
												<div class="text-destructive px-2 py-3 text-sm">{searchError}</div>
											{:else if searchQuery.trim().length < 2}
												<Command.Empty>Type at least 2 characters.</Command.Empty>
											{:else if suggestions.length === 0}
												<Command.Empty>No cities found.</Command.Empty>
											{:else}
												<Command.Group heading="Cities">
													{#each suggestions as suggestion (suggestion.id)}
														<Command.Item
															value={suggestion.label}
															onSelect={() => selectSuggestion(suggestion)}
														>
															<div class="min-w-0">
																<div class="truncate font-medium">{suggestion.label}</div>
																<div class="text-muted-foreground truncate text-xs">
																	{suggestion.timezone}
																</div>
															</div>
														</Command.Item>
													{/each}
												</Command.Group>
											{/if}
										</Command.List>
									</Command.Root>
								</div>
							</Popover.Content>
						</Popover.Root>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<input type="hidden" name="timezone" value={$formData.timezone ?? ''} />
			<input type="hidden" name="latitude" value={hiddenNumberValue($formData.latitude)} />
			<input type="hidden" name="longitude" value={hiddenNumberValue($formData.longitude)} />

			<Form.Field {form} name="sortOrder">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Sort order</Form.Label>
						<Input {...props} type="number" bind:value={$formData.sortOrder} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<div class="flex gap-2">
				<Form.Button disabled={!hasCityDetails}>{data.isEdit ? 'Save' : 'Create'}</Form.Button>
				<a href="/admin" class={buttonVariants({ variant: 'outline' })}>Cancel</a>
			</div>
		</form>
	</main>
</div>

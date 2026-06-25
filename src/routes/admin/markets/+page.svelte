<script lang="ts">
	import { resolve } from '$app/paths';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { ArrowLeft } from '@lucide/svelte';
	import { marketCreateSchema } from '$lib/schemas';
	import * as Form from '$lib/components/ui/form';
	import { Switch } from '$lib/components/ui/switch';
	import { buttonVariants } from '$lib/components/ui/button';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally (Superforms is initialized once from page load data.)
	const form = superForm(data.form, { validators: zod4Client(marketCreateSchema) });
	const { form: formData, enhance } = form;

	function optionLabel(market: PageData['availableMarkets'][number]): string {
		return `${market.title} · ${market.city}, ${market.country}`;
	}

	let selectedMarket = $derived(
		data.availableMarkets.find((market) => String(market.id) === $formData.supportedMarketId)
	);
</script>

<svelte:head><title>Add market · Admin</title></svelte:head>

<div class="bg-background text-foreground min-h-screen">
	<main class="mx-auto max-w-xl px-4 py-8">
		<div class="mb-6 flex items-center gap-3">
			<a
				href={resolve('/admin?tab=markets')}
				class={buttonVariants({ variant: 'ghost', size: 'icon' })}
				aria-label="Back"
			>
				<ArrowLeft class="size-4" />
			</a>
			<h1 class="text-lg font-semibold">Add market</h1>
		</div>

		{#if data.availableMarkets.length}
			<form method="POST" use:enhance class="space-y-4">
				<Form.Field {form} name="supportedMarketId">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>Exchange</Form.Label>
							<select
								{...props}
								bind:value={$formData.supportedMarketId}
								class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
							>
								<option value="">Select an exchange</option>
								{#each data.availableMarkets as market (market.id)}
									<option value={String(market.id)}>{optionLabel(market)}</option>
								{/each}
							</select>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>

				<Form.Field {form} name="hidden">
					<div class="flex items-center justify-between rounded-lg border p-3">
						<Form.Control>
							{#snippet children({ props })}
								<Form.Label>Hidden from hub</Form.Label>
								<Switch {...props} bind:checked={$formData.hidden} />
							{/snippet}
						</Form.Control>
					</div>
					<Form.FieldErrors />
				</Form.Field>

				{#if selectedMarket}
					<div class="bg-muted/40 rounded-lg border p-3 text-sm">
						<p class="font-medium">{selectedMarket.title}</p>
						<p class="text-muted-foreground mt-1">
							{selectedMarket.city}, {selectedMarket.country}
						</p>
					</div>
				{/if}

				<div class="flex gap-2">
					<Form.Button>Create</Form.Button>
					<a href={resolve('/admin?tab=markets')} class={buttonVariants({ variant: 'outline' })}
						>Cancel</a
					>
				</div>
			</form>
		{:else}
			<div class="rounded-lg border p-4">
				<p class="text-muted-foreground text-sm">
					All canonical exchanges are already configured in the watchlist.
				</p>
				<a
					href={resolve('/admin?tab=markets')}
					class={buttonVariants({ variant: 'outline', class: 'mt-4' })}
				>
					Back to markets
				</a>
			</div>
		{/if}
	</main>
</div>

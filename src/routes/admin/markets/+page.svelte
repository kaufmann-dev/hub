<script lang="ts">
	import { resolve } from '$app/paths';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { ArrowLeft } from '@lucide/svelte';
	import { marketCreateSchema } from '$lib/schemas';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import { Switch } from '$lib/components/ui/switch';
	import { buttonVariants } from '$lib/components/ui/button';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally (Superforms is initialized once from page load data.)
	const form = superForm(data.form, { validators: zod4Client(marketCreateSchema) });
	const { form: formData, enhance } = form;

	function marketKey(market: PageData['availableMarkets'][number]): string {
		return `${market.marketType.trim().toLowerCase()}::${market.region.trim().toLowerCase()}`;
	}

	function optionLabel(market: PageData['availableMarkets'][number]): string {
		const sourceLabel = market.statusSource === 'schedule' ? ' · Schedule' : '';
		return `${market.marketType} · ${market.region} · ${market.primaryExchanges}${sourceLabel}`;
	}

	let selectedMarket = $derived(
		data.availableMarkets.find((market) => marketKey(market) === $formData.marketKey)
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
				<Form.Field {form} name="marketKey">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>Market</Form.Label>
							<select
								{...props}
								bind:value={$formData.marketKey}
								class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
							>
								<option value="">Select a market</option>
								{#each data.availableMarkets as market (marketKey(market))}
									<option value={marketKey(market)}>{optionLabel(market)}</option>
								{/each}
							</select>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>

				<Form.Field {form} name="displayName">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>Display name</Form.Label>
							<Input
								{...props}
								placeholder={selectedMarket?.region ?? 'Shown on the hub'}
								bind:value={$formData.displayName}
							/>
						{/snippet}
					</Form.Control>
					<Form.Description>Leave empty to use the supported market display name.</Form.Description>
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
					No supported markets are available to add. Configure live market access or refresh after
					the provider cache has data.
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

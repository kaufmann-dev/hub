<script lang="ts">
	import { resolve } from '$app/paths';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { ArrowLeft } from '@lucide/svelte';
	import { marketWatchlistSchema } from '$lib/schemas';
	import * as Form from '$lib/components/ui/form';
	import { Switch } from '$lib/components/ui/switch';
	import { buttonVariants } from '$lib/components/ui/button';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally (Superforms is initialized once from page load data.)
	const form = superForm(data.form, { validators: zod4Client(marketWatchlistSchema) });
	const { form: formData, enhance } = form;
</script>

<svelte:head><title>Edit market · Admin</title></svelte:head>

<div class="bg-background text-foreground min-h-screen">
	<main class="mx-auto max-w-xl px-4 py-8">
		<div class="mb-2 flex items-center gap-3">
			<a
				href={resolve('/admin?tab=markets')}
				class={buttonVariants({ variant: 'ghost', size: 'icon' })}
				aria-label="Back"
			>
				<ArrowLeft class="size-4" />
			</a>
			<h1 class="text-lg font-semibold">{data.market.market.title}</h1>
		</div>
		<p class="text-muted-foreground mb-6 pl-12 text-sm">
			{data.market.market.city}, {data.market.market.country}
		</p>

		<form method="POST" use:enhance class="space-y-4">
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
				<Form.Button>Save</Form.Button>
				<a href={resolve('/admin?tab=markets')} class={buttonVariants({ variant: 'outline' })}
					>Cancel</a
				>
			</div>
		</form>
	</main>
</div>

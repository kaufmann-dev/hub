<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { ArrowLeft } from '@lucide/svelte';
	import { citySchema } from '$lib/schemas';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import { buttonVariants } from '$lib/components/ui/button';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const form = superForm(data.form, { validators: zod4Client(citySchema) });
	const { form: formData, enhance } = form;
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
						<Form.Label>Name</Form.Label>
						<Input {...props} placeholder="Vienna" bind:value={$formData.name} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field {form} name="timezone">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Timezone (IANA)</Form.Label>
						<Input {...props} placeholder="Europe/Vienna" bind:value={$formData.timezone} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<div class="grid grid-cols-2 gap-4">
				<Form.Field {form} name="latitude">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>Latitude</Form.Label>
							<Input {...props} type="number" step="any" bind:value={$formData.latitude} />
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>

				<Form.Field {form} name="longitude">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>Longitude</Form.Label>
							<Input {...props} type="number" step="any" bind:value={$formData.longitude} />
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>
			</div>

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
				<Form.Button>{data.isEdit ? 'Save' : 'Create'}</Form.Button>
				<a href="/admin" class={buttonVariants({ variant: 'outline' })}>Cancel</a>
			</div>
		</form>
	</main>
</div>

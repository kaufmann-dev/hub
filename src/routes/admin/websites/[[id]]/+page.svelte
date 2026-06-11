<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { ArrowLeft } from '@lucide/svelte';
	import { websiteSchema } from '$lib/schemas';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { NativeSelect } from '$lib/components/ui/native-select';
	import { buttonVariants } from '$lib/components/ui/button';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const form = superForm(data.form, { validators: zod4Client(websiteSchema) });
	const { form: formData, enhance } = form;
</script>

<svelte:head><title>{data.isEdit ? 'Edit website' : 'Add website'} · Admin</title></svelte:head>

<div class="bg-background text-foreground min-h-screen">
	<main class="mx-auto max-w-xl px-4 py-8">
		<div class="mb-6 flex items-center gap-3">
			<a href="/admin" class={buttonVariants({ variant: 'ghost', size: 'icon' })} aria-label="Back">
				<ArrowLeft class="size-4" />
			</a>
			<h1 class="text-lg font-semibold">{data.isEdit ? 'Edit website' : 'Add website'}</h1>
		</div>

		<form method="POST" use:enhance class="space-y-4">
			<Form.Field {form} name="title">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Title</Form.Label>
						<Input {...props} bind:value={$formData.title} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field {form} name="url">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>URL</Form.Label>
						<Input
							{...props}
							type="url"
							placeholder="https://example.com"
							bind:value={$formData.url}
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field {form} name="description">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Description</Form.Label>
						<Textarea {...props} bind:value={$formData.description} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field {form} name="kind">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Kind</Form.Label>
						<NativeSelect {...props} bind:value={$formData.kind}>
							<option value="personal">Personal</option>
							<option value="third_party">Third-party</option>
						</NativeSelect>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field {form} name="iconUrl">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Icon URL (optional)</Form.Label>
						<Input
							{...props}
							placeholder="Leave empty to use the site favicon"
							bind:value={$formData.iconUrl}
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

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

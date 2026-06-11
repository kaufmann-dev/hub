<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { ArrowLeft } from '@lucide/svelte';
	import { websiteSchema } from '$lib/schemas';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select';
	import { buttonVariants } from '$lib/components/ui/button';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally (Superforms is initialized once from page load data.)
	const form = superForm(data.form, { validators: zod4Client(websiteSchema) });
	const { form: formData, enhance } = form;
	const kindLabel = $derived($formData.kind === 'third_party' ? 'Third-party' : 'Personal');
</script>

<svelte:head><title>{data.isEdit ? 'Edit website' : 'Add website'} · Admin</title></svelte:head>

<div class="bg-background text-foreground min-h-screen">
	<main class="mx-auto max-w-xl px-4 py-8">
		<div class="mb-6 flex items-center gap-3">
			<a
				href="/admin?tab=websites"
				class={buttonVariants({ variant: 'ghost', size: 'icon' })}
				aria-label="Back"
			>
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
						<Select.Root type="single" name={props.name} bind:value={$formData.kind}>
							<Select.Trigger
								id={props.id}
								aria-invalid={props['aria-invalid']}
								aria-describedby={props['aria-describedby']}
							>
								{kindLabel}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="personal" label="Personal">Personal</Select.Item>
								<Select.Item value="third_party" label="Third-party">Third-party</Select.Item>
							</Select.Content>
						</Select.Root>
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

			<div class="flex gap-2">
				<Form.Button>{data.isEdit ? 'Save' : 'Create'}</Form.Button>
				<a href="/admin?tab=websites" class={buttonVariants({ variant: 'outline' })}>Cancel</a>
			</div>
		</form>
	</main>
</div>

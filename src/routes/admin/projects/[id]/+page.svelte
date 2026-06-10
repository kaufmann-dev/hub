<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { ArrowLeft, Star } from '@lucide/svelte';
	import { projectSchema } from '$lib/schemas';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Switch } from '$lib/components/ui/switch';
	import { buttonVariants } from '$lib/components/ui/button';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const form = superForm(data.form, { validators: zod4Client(projectSchema) });
	const { form: formData, enhance } = form;
</script>

<svelte:head><title>Edit project · Admin</title></svelte:head>

<div class="bg-background text-foreground min-h-screen">
	<main class="mx-auto max-w-xl px-4 py-8">
		<div class="mb-2 flex items-center gap-3">
			<a href="/admin" class={buttonVariants({ variant: 'ghost', size: 'icon' })} aria-label="Back">
				<ArrowLeft class="size-4" />
			</a>
			<h1 class="text-lg font-semibold">{data.project.name}</h1>
		</div>
		<p class="text-muted-foreground mb-6 flex items-center gap-2 pl-12 text-sm">
			<a href={data.project.url} target="_blank" rel="noopener noreferrer" class="hover:underline">
				{data.project.fullName}
			</a>
			<span class="inline-flex items-center gap-1"><Star class="size-3" />{data.project.stars}</span
			>
		</p>

		<form method="POST" use:enhance class="space-y-4">
			<Form.Field {form} name="descriptionOverride">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Description override</Form.Label>
						<Textarea
							{...props}
							placeholder={data.project.description ?? 'Custom description shown on the hub'}
							bind:value={$formData.descriptionOverride}
						/>
					{/snippet}
				</Form.Control>
				<Form.Description>Leave empty to use the synced GitHub description.</Form.Description>
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
				<Form.Button>Save</Form.Button>
				<a href="/admin" class={buttonVariants({ variant: 'outline' })}>Cancel</a>
			</div>
		</form>
	</main>
</div>

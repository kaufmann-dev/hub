<script lang="ts">
	import { enhance as enhanceAction } from '$app/forms';
	import { fileProxy, superForm, type Infer, type SuperValidated } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';
	import { websiteIconSchema, type WebsiteIconSchema } from '#lib/schemas.js';
	import { faviconUrls } from '#lib/favicon.js';
	import WebsiteIcon from '#lib/components/hub/WebsiteIcon.svelte';
	import * as Form from '#lib/components/ui/form/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Button } from '#lib/components/ui/button/index.js';

	let {
		iconForm,
		websiteId,
		iconVersion,
		hasIconOverride
	}: {
		iconForm: SuperValidated<Infer<WebsiteIconSchema>>;
		websiteId: number;
		iconVersion: Date | null;
		hasIconOverride: boolean;
	} = $props();

	// svelte-ignore state_referenced_locally (Superforms is initialized once from page load data.)
	const form = superForm(iconForm, {
		validators: zod4Client(websiteIconSchema),
		onUpdated: ({ form }) => {
			if (form.valid) toast.success('Icon saved.');
		}
	});
	const { enhance, submitting } = form;
	const icon = fileProxy(form, 'icon');
	const darkIcon = fileProxy(form, 'darkIcon');
	const preview = $derived(faviconUrls(websiteId, iconVersion));
	const accept = 'image/png,image/svg+xml,image/jpeg,image/gif,image/webp,image/x-icon,.ico';
</script>

<section class="mt-10 space-y-4 border-t pt-6">
	<div class="flex items-center gap-3">
		<div class="rounded-md border bg-muted/40 p-2">
			<WebsiteIcon lightSrc={preview.light} darkSrc={preview.dark} />
		</div>
		<div>
			<h2 class="text-sm font-semibold">Icon override</h2>
			<p class="text-sm text-muted-foreground">
				{hasIconOverride
					? 'Showing an uploaded icon instead of the discovered favicon.'
					: 'Showing the discovered favicon. Upload an icon to replace it.'}
			</p>
		</div>
	</div>

	<form method="POST" action="?/icon" enctype="multipart/form-data" use:enhance class="space-y-4">
		<Form.Field {form} name="icon">
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>Icon</Form.Label>
					<Input {...props} type="file" {accept} bind:files={$icon} />
				{/snippet}
			</Form.Control>
			<Form.Description
				>Used for both themes unless a dark icon is set. Max 200 KB.</Form.Description
			>
			<Form.FieldErrors />
		</Form.Field>

		<Form.Field {form} name="darkIcon">
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>Dark icon (optional)</Form.Label>
					<Input {...props} type="file" {accept} bind:files={$darkIcon} />
				{/snippet}
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>

		<div class="flex gap-2">
			<Form.Button disabled={$submitting}>Upload icon</Form.Button>
			{#if hasIconOverride}
				<Button type="submit" variant="outline" form="remove-icon">Use discovered favicon</Button>
			{/if}
		</div>
	</form>

	<form
		id="remove-icon"
		method="POST"
		action="?/removeIcon"
		use:enhanceAction={() =>
			async ({ result, update }) => {
				if (result.type === 'success') toast.success('Icon override removed.');
				await update();
			}}
	></form>
</section>

<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { LockKeyhole } from '@lucide/svelte';
	import { loginSchema } from '$lib/schemas';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally (Superforms is initialized once from page load data.)
	const form = superForm(data.form, { validators: zod4Client(loginSchema) });
	const { form: formData, enhance, message } = form;
</script>

<svelte:head><title>Admin · Login</title></svelte:head>

<div class="bg-background text-foreground flex min-h-screen items-center justify-center px-4">
	<div class="bg-card text-card-foreground w-full max-w-sm rounded-xl border p-6">
		<div class="mb-6 flex items-center gap-2">
			<LockKeyhole class="size-5" />
			<h1 class="text-lg font-semibold">Admin login</h1>
		</div>

		<form method="POST" use:enhance class="space-y-4">
			<Form.Field {form} name="password">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Password</Form.Label>
						<Input {...props} type="password" bind:value={$formData.password} autofocus />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			{#if $message}
				<p class="text-destructive text-sm">{$message}</p>
			{/if}

			<Form.Button class="w-full">Sign in</Form.Button>
		</form>
	</div>
</div>

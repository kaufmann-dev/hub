<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { LockKeyhole } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';

	const oidcError = $derived(page.url.searchParams.get('error') === 'oidc');
</script>

<svelte:head><title>Admin · Login</title></svelte:head>

<div class="bg-background text-foreground flex min-h-screen items-center justify-center px-4">
	<div class="bg-card text-card-foreground w-full max-w-sm rounded-xl border p-6">
		<div class="mb-6 flex items-center gap-2">
			<LockKeyhole class="size-5" />
			<h1 class="text-lg font-semibold">Admin login</h1>
		</div>

		{#if oidcError}
			<p class="text-destructive mb-4 text-sm">Sign-in failed. Please try again.</p>
		{/if}

		<Button href={resolve('/auth/login')} class="w-full">Sign in with Pocket ID</Button>
	</div>
</div>

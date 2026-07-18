<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Toaster } from '$lib/components/ui/sonner';
	import '../../../routes/layout.css';

	const feedbackId = 'admin-feedback-test';
	const warningMessage = 'Refreshed 17 icons; 1 failed.';
</script>

<Toaster position="bottom-right" closeButton />

<div class="space-y-3 p-6">
	<div class="h-12" data-layout-anchor>Stable admin content</div>
	<button
		type="button"
		onclick={() =>
			toast.warning(warningMessage, {
				id: feedbackId,
				description: 'Failed website: Authentik'
			})}
	>
		Show favicon warning
	</button>
</div>

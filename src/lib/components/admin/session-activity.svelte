<script lang="ts">
	// Mirrors USER_ACTIVITY_PATH/HEADER in $lib/server/auth/session-policy.ts
	// (server-only module, not importable from client code).
	const MINIMUM_SIGNAL_INTERVAL_MS = 60 * 1000;
	let lastSignalAt = 0;

	function recordActivity(event: Event): void {
		if (!event.isTrusted) return;
		const now = Date.now();
		if (now - lastSignalAt < MINIMUM_SIGNAL_INTERVAL_MS) return;
		lastSignalAt = now;
		void fetch('/auth/activity', {
			method: 'POST',
			headers: { 'x-hub-user-activity': 'true' },
			credentials: 'same-origin',
			keepalive: true
		}).catch(() => undefined);
	}
</script>

<svelte:window onpointerdown={recordActivity} onkeydown={recordActivity} onclick={recordActivity} />

import { createSubscriber } from 'svelte/reactivity';

/**
 * A shared reactive clock. Reading `clock.now` inside a reactive context (template,
 * $derived) registers a once-per-second tick that is started and torn down
 * automatically via `createSubscriber` — no manual $effect/onMount needed.
 */
class Clock {
	#subscribe = createSubscriber((update) => {
		const id = setInterval(update, 1000);
		return () => clearInterval(id);
	});

	get now(): Date {
		this.#subscribe();
		return new Date();
	}
}

export const clock = new Clock();

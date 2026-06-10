<script lang="ts">
	import {
		Sun,
		CloudSun,
		Cloud,
		CloudFog,
		CloudDrizzle,
		CloudRain,
		Snowflake,
		CloudLightning
	} from '@lucide/svelte';
	import type { WeatherIconKey } from '$lib/weather-codes';

	let { icon, class: className }: { icon: WeatherIconKey; class?: string } = $props();

	const map = {
		sun: Sun,
		'cloud-sun': CloudSun,
		cloud: Cloud,
		'cloud-fog': CloudFog,
		'cloud-drizzle': CloudDrizzle,
		'cloud-rain': CloudRain,
		snowflake: Snowflake,
		'cloud-lightning': CloudLightning
	};

	const Icon = $derived(map[icon] ?? Cloud);
</script>

<Icon class={className} />

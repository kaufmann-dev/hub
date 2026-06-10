/**
 * Maps WMO weather interpretation codes (as returned by Open-Meteo) to a short
 * label and an icon key. The icon key is resolved to a Lucide component in the UI,
 * so this module stays free of Svelte/component imports and is safe to share
 * between server and client.
 */
export type WeatherIconKey =
	| 'sun'
	| 'cloud-sun'
	| 'cloud'
	| 'cloud-fog'
	| 'cloud-drizzle'
	| 'cloud-rain'
	| 'snowflake'
	| 'cloud-lightning';

export interface WeatherInfo {
	label: string;
	icon: WeatherIconKey;
}

export function weatherCodeToInfo(code: number): WeatherInfo {
	switch (code) {
		case 0:
			return { label: 'Clear', icon: 'sun' };
		case 1:
			return { label: 'Mainly clear', icon: 'cloud-sun' };
		case 2:
			return { label: 'Partly cloudy', icon: 'cloud-sun' };
		case 3:
			return { label: 'Overcast', icon: 'cloud' };
		case 45:
		case 48:
			return { label: 'Fog', icon: 'cloud-fog' };
		case 51:
		case 53:
		case 55:
		case 56:
		case 57:
			return { label: 'Drizzle', icon: 'cloud-drizzle' };
		case 61:
		case 63:
		case 65:
		case 66:
		case 67:
		case 80:
		case 81:
		case 82:
			return { label: 'Rain', icon: 'cloud-rain' };
		case 71:
		case 73:
		case 75:
		case 77:
		case 85:
		case 86:
			return { label: 'Snow', icon: 'snowflake' };
		case 95:
		case 96:
		case 99:
			return { label: 'Thunderstorm', icon: 'cloud-lightning' };
		default:
			return { label: 'Unknown', icon: 'cloud' };
	}
}

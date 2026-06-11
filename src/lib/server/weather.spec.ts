import { describe, it, expect } from 'vitest';
import { getWeather } from './weather';

describe('getWeather', () => {
	it('fetches weather for Vienna', async () => {
		const result = await getWeather({
			id: 1,
			latitude: 48.2082,
			longitude: 16.3738
		});
		console.log('Vienna Weather:', result);
		expect(result).not.toBeNull();
		if (result) {
			expect(typeof result.temperature).toBe('number');
			expect(typeof result.unit).toBe('string');
			expect(typeof result.label).toBe('string');
			expect(typeof result.icon).toBe('string');
		}
	});
});

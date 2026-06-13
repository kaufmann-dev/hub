import { describe, expect, it } from 'vitest';
import { staticizeSvgTheme } from './favicon-svg';

function render(svg: string, theme: 'light' | 'dark'): string {
	return staticizeSvgTheme(Buffer.from(svg), theme).toString('utf8');
}

describe('staticizeSvgTheme', () => {
	it('removes the opposite scheme and unwraps the requested scheme', () => {
		const svg = `
			<svg>
				<style>
					path { fill: gray }
					@media (prefers-color-scheme: light) { path { fill: black } }
					@media (prefers-color-scheme: dark) { path { fill: white } }
				</style>
			</svg>
		`;

		expect(render(svg, 'light')).toContain('path { fill: black }');
		expect(render(svg, 'light')).not.toContain('path { fill: white }');
		expect(render(svg, 'dark')).not.toContain('path { fill: black }');
		expect(render(svg, 'dark')).toContain('path { fill: white }');
		expect(render(svg, 'dark')).not.toContain('prefers-color-scheme');
	});

	it('preserves unrelated media rules and handles nested blocks', () => {
		const svg = `
			<svg>
				<style>
					@media (min-width: 10px) { path { stroke: red } }
					@media (prefers-color-scheme: dark) {
						@supports (fill: color(display-p3 1 1 1)) { path { fill: white } }
					}
				</style>
			</svg>
		`;

		const dark = render(svg, 'dark');
		expect(dark).toContain('@media (min-width: 10px)');
		expect(dark).toContain('@supports (fill: color(display-p3 1 1 1))');
		expect(dark).not.toContain('prefers-color-scheme');
	});

	it('leaves SVGs without theme media rules unchanged', () => {
		const svg = '<svg><style>path { fill: red }</style><path /></svg>';
		expect(render(svg, 'dark')).toBe(svg);
	});
});

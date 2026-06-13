export type FaviconTheme = 'light' | 'dark';

function findBlockEnd(css: string, openingBrace: number): number {
	let depth = 1;
	let quote = '';
	let inComment = false;

	for (let index = openingBrace + 1; index < css.length; index += 1) {
		const char = css[index];
		const next = css[index + 1];

		if (inComment) {
			if (char === '*' && next === '/') {
				inComment = false;
				index += 1;
			}
			continue;
		}
		if (quote) {
			if (char === '\\') index += 1;
			else if (char === quote) quote = '';
			continue;
		}
		if (char === '/' && next === '*') {
			inComment = true;
			index += 1;
		} else if (char === '"' || char === "'") {
			quote = char;
		} else if (char === '{') {
			depth += 1;
		} else if (char === '}' && --depth === 0) {
			return index;
		}
	}

	return -1;
}

function staticizeCss(css: string, theme: FaviconTheme): string {
	const mediaPattern = /@media\b/gi;
	let result = '';
	let cursor = 0;
	let match: RegExpExecArray | null;

	while ((match = mediaPattern.exec(css))) {
		const openingBrace = css.indexOf('{', match.index + match[0].length);
		if (openingBrace === -1) break;

		const condition = css.slice(match.index + match[0].length, openingBrace);
		const scheme = condition.match(/prefers-color-scheme\s*:\s*(light|dark)/i)?.[1]?.toLowerCase();
		if (!scheme) continue;

		const closingBrace = findBlockEnd(css, openingBrace);
		if (closingBrace === -1) break;

		result += css.slice(cursor, match.index);
		if (scheme === theme) {
			result += staticizeCss(css.slice(openingBrace + 1, closingBrace), theme);
		}
		cursor = closingBrace + 1;
		mediaPattern.lastIndex = cursor;
	}

	return result + css.slice(cursor);
}

/** Resolve embedded prefers-color-scheme rules so image rendering cannot choose its own theme. */
export function staticizeSvgTheme(data: Buffer, theme: FaviconTheme): Buffer {
	const svg = data.toString('utf8');
	const transformed = svg.replace(
		/(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi,
		(_match, opening: string, css: string, closing: string) =>
			`${opening}${staticizeCss(css, theme)}${closing}`
	);
	return Buffer.from(transformed, 'utf8');
}

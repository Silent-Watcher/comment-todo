import { relative } from 'node:path';
import type { MetaKV, Tag } from '../common/types';

export function normalizeTag(raw: string): Tag | null {
	const t = String(raw || '').toUpperCase();
	if (t === 'TODO' || t === 'FIXME' || t === 'HACK') return t as Tag;
	return null;
}

function splitMetaParts(s: string): string[] {
	// split by commas, or by two+ spaces, or by ' | '
	return s
		.split(/[,|]+|\s{2,}/)
		.map((p) => p.trim())
		.filter(Boolean);
}

export function relativePath(root: string, file: string) {
	const rel = relative(root, file);
	return rel === '' ? '.' : rel;
}

/**
 * Parse a comment tail for metadata and message.
 *
 * Examples of supported comment formats:
 *   TODO(@alice due:2025-09-01): implement X
 *   FIXME: remove hack
 *   TODO (assignee: bob, due:2025-09-01) implement
 *
 * Returns { text, meta } where text is the user message and meta contains parsed key-values.
 */
export function parseCommentMeta(raw: string): { text: string; meta?: MetaKV } {
	// We expect raw input like:
	// "(@alice due:2025-09-01): message..."
	// "(@alice): message"
	// "assignee:alice, due:2025-09-01 message..."
	const meta: MetaKV = {};
	let text = raw.trim();

	// First, look for parentheses immediately after the tag, e.g. "(@alice due:2025-09-01): rest"
	const parenMatch = text.match(
		/^\(?\s*([^)]{1,200})\s*\)?\s*[:-]?\s*(.*)$/s,
	);
	if (parenMatch) {
		const inside = parenMatch[1]?.trim();
		const rest = (parenMatch[2] || '').trim();
		// inside could be "@alice" or "assignee:alice, due:2025-09-01" or "bob"
		// split by commas or spaces with colon detection
		const parts = splitMetaParts(inside as string);
		for (const part of parts) {
			if (!part) continue;
			// @alice -> assignee = alice
			const atMatch = part.match(/^@([A-Za-z0-9_\-.]+)$/);
			if (atMatch) {
				meta.assignee = atMatch[1];
				continue;
			}
			const keyValue = part.split(':').map((s) => s.trim());
			if (keyValue.length === 2) {
				meta[keyValue[0] as string] = keyValue[1];
			} else if (keyValue.length === 1) {
				// no key: assume assignee
				meta.assignee = keyValue[0];
			}
		}
		if (rest) text = rest;
	} else {
		// No parentheses: try to extract inline key:value pairs at start
		const keyValueInline = text.match(/^([A-Za-z0-9_-]+:[^\s]+)\s+(.*)$/s);
		if (keyValueInline) {
			const keyValueRaw = keyValueInline[1];
			const rest = keyValueInline[2];
			const keyValueParts = keyValueRaw?.split(',');
			for (const part of keyValueParts as string[]) {
				const [key, value] = part.split(':').map((s) => s.trim());
				if (key && value) meta[key] = value;
			}
			text = rest?.trim() as string;
		}
	}
	return {
		text: text || '',
		meta: Object.keys(meta).length ? meta : undefined,
	};
}

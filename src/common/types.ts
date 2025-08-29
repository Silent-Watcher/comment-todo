export interface ExtractOptions {
	root: string;
	exts?: string[]; // extensions without leading dot
	ignore?: string[]; // glob patterns to ignore
	concurrency?: number;
	verbose?: boolean;
}

export type Tag = 'TODO' | 'FIXME' | 'HACK';

export interface MetaKV {
	[key: string]: string | undefined;
}

export interface FoundComment {
	tag: Tag;
	file: string; // relative to root
	line: number; // 1-based
	text: string; // the message part
	raw?: string; // raw comment line text (optional)
	meta?: MetaKV; // parsed metadata (assignee, due, etc.)
}

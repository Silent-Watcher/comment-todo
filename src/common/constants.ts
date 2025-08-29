export const DEFAULT_IGNORE_GLOBS: string[] = [
	'node_modules/**',
	'.git/**',
	'dist/**',
] as const;

export const DEFAULT_SUPPORTED_EXTS: string[] = [
	'js',
	'ts',
	'jsx',
	'tsx',
	'py',
	'sh',
	'php',
	'go',
] as const;

export const FALLBACK_PREFIXES = ['#', '//', '--', ';', '%']; // common comment starts

export const JS_TS_EXTS = new Set(['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs']);
export const PHP_EXTS = new Set(['php']);

import { readFile } from 'node:fs/promises';
import os from 'node:os';
import { extname } from 'node:path';
import { parse as babelParse } from '@babel/parser';
import fg from 'fast-glob';
import pLimit from 'p-limit';
import PHPParser from 'php-parser';
import {
	DEFAULT_IGNORE_GLOBS,
	DEFAULT_SUPPORTED_EXTS,
	FALLBACK_PREFIXES,
	JS_TS_EXTS,
	PHP_EXTS,
} from '../common/constants';
import type { ExtractOptions, FoundComment, Tag } from '../common/types';
import { normalizeTag, parseCommentMeta, relativePath } from './helpers';

export async function findComments(opts: ExtractOptions) {
	const root = opts.root || process.cwd();
	const exts =
		opts.exts && opts.exts.length ? opts.exts : DEFAULT_SUPPORTED_EXTS;
	const ignore = opts.ignore || DEFAULT_IGNORE_GLOBS;
	const concurrency = opts.concurrency ?? Math.max(4, os.cpus().length);

	const patterns = exts.map((e) => `**/*.${e}`);
	const foundedFiles = await fg(patterns, {
		cwd: root,
		ignore,
		absolute: true,
	});

	const limitConcurrentExecution = pLimit(concurrency);
	const foundedComments: FoundComment[] = [];

	const phpParser = new PHPParser.Engine({
		parser: { extractDoc: true, php7: true },
		ast: { withPositions: true },
	});

	await Promise.all(
		foundedFiles.map((file) =>
			limitConcurrentExecution(async () => {
				const ext = extname(file).replace('.', '').toLowerCase();
				try {
					const content = await readFile(file, 'utf-8');
					if (JS_TS_EXTS.has(ext)) {
						// Use @babel/parser to get comments reliably (avoids strings)
						try {
							const ast = babelParse(content, {
								sourceType: 'unambiguous',
								plugins: [
									'typescript',
									'jsx',
									'decorators-legacy',
									'classProperties',
									'classPrivateProperties',
									'optionalChaining',
									'nullishCoalescingOperator',
								],
							});
							const comments = (ast as any).comments as Array<{
								value: string;
								loc?: any;
								start?: number;
								end?: number;
							}>;
							if (comments && comments.length) {
								for (const comment of comments) {
									// comment value is the inside, might span multiple lines
									const lines = comment.value.split(/\r?\n/);
									const lineNo =
										comment.loc?.start?.line ?? undefined;
									for (
										let index = 0;
										index < lines.length;
										index++
									) {
										const rawLine = lines[index]?.trim();
										const matched = rawLine?.match(
											/^(\*?\s*)?(TODO|FIXME|HACK)(.*)$/i,
										);
										if (matched) {
											const tag = normalizeTag(
												matched[2] as Tag,
											);
											if (!tag) continue;
											// compute line number: Babel returns loc start for the whole comment block. Approximate per-line.
											const currentLine =
												(lineNo
													? lineNo + index
													: undefined) || 0;
											const tail = matched[3]
												? matched[3].trim()
												: '';
											const { text, meta } =
												parseCommentMeta(tail);
											foundedComments.push({
												tag,
												file: relativePath(root, file),
												line: lineNo,
												text,
												raw: rawLine,
												meta,
											});
										}
									}
								}
							}
						} catch (error) {
							// If parsing fails, fallback to line scan
							if (opts.verbose) {
								console.warn(
									`babel parse failed for ${file}, falling back to line-scan: ${
										(error as Error).message
									}`,
								);
							}
							scanLinesForTags(
								content,
								file,
								root,
								foundedComments,
							);
						}
					} else if (PHP_EXTS.has(ext)) {
						try {
							const prog = phpParser.parseCode(content, file);
							// php-parser keeps comments: prog[1] may contain comments? There's a `comments` property.
							const comments =
								(prog &&
									(prog as any).tokens &&
									(prog as any).comments) ??
								(prog &&
									(prog as any).children &&
									(prog as any).children.comments) ??
								(prog && (prog as any).comments);
							// php-parser shape is inconsistent across versions; safest approach: fallback to scanning but also check docblocks if present
							if (comments && Array.isArray(comments)) {
								for (const comment of comments) {
									const val = String(
										comment.value ||
											comment.source ||
											comment,
									).split(/\r?\n/);
									for (let i = 0; i < val.length; i++) {
										const rawLine = val[i]?.trim();
										const matched = rawLine?.match(
											/^(\/\*+|\*|\/\/|#)?\s*(TODO|FIXME|HACK)(.*)$/i,
										);
										if (matched) {
											const tag = normalizeTag(
												matched[2] as string,
											);
											if (!tag) continue;
											const lineNo = comment.loc?.start
												?.line
												? comment.loc.start.line + i
												: (comment.line ?? 1);
											const tail = matched[3]
												? matched[3].trim()
												: '';
											const { text, meta } =
												parseCommentMeta(tail);
											foundedComments.push({
												tag,
												file: relativePath(root, file),
												line: lineNo,
												text,
												raw: rawLine,
												meta,
											});
										}
									}
								}
							} else {
								// fallback to line scan
								scanLinesForTags(
									content,
									file,
									root,
									foundedComments,
								);
							}
						} catch (error) {
							if (opts.verbose) {
								console.warn(
									`php-parser failed for ${file}, falling back to line-scan: ${
										(error as Error).message
									}`,
								);
							}
							scanLinesForTags(
								content,
								file,
								root,
								foundedComments,
							);
						}
					} else {
						// Fallback scanning for other file types
						scanLinesForTags(content, file, root, foundedComments);
					}
				} catch (error) {
					if (opts.verbose) {
						console.warn(
							`Failed to read ${file}: ${
								(error as Error).message
							}`,
						);
					}
				}
			}),
		),
	);
	// sort results
	foundedComments.sort(
		(a, b) => a.file.localeCompare(b.file) || a.line - b.line,
	);
	return foundedComments;
}

/** line-based scan for tags (fallback). Adds to results array. */
function scanLinesForTags(
	content: string,
	absPath: string,
	root: string,
	results: FoundComment[],
) {
	const lines = content.split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i];
		// quick check if contains one of the tags
		const tagMatch = raw?.match(/(TODO|FIXME|HACK)/i);
		if (!tagMatch) continue;
		// now ensure it's a comment-ish line by checking for common prefixes before the tag in the line
		const idx = raw?.toUpperCase().indexOf(tagMatch[0].toUpperCase());
		const prefix = raw?.slice(0, idx);
		const hasCommentPrefix = FALLBACK_PREFIXES.some((p: string) =>
			prefix?.trim().endsWith(p),
		);
		// also accept inline block comment marker "/*" earlier
		const hasBlockStart = prefix?.includes('/*') || prefix?.includes('*');
		if (!hasCommentPrefix && !hasBlockStart) {
			// skip; likely inside string or code
			continue;
		}
		// now extract suffix after the tag
		const suffix = raw
			?.slice((idx as number) + tagMatch[0].length)
			.replace(/^[:\-)\s]*/, '')
			.trim();
		const tag = normalizeTag(tagMatch[0]);
		if (!tag) continue;
		const { text, meta } = parseCommentMeta(suffix as string);
		results.push({
			tag,
			file: relativePath(root, absPath),
			line: i + 1,
			text,
			raw: raw?.trim(),
			meta,
		});
	}
}

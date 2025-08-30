#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { findComments } from './utils/extractor';
import { generateJSON, generateMarkdown } from './utils/generator';
import { initialProgram } from './utils/program';

async function main() {
	const program = initialProgram();

	const options = program.opts();

	const rootDirToScan: string = resolve(options.root.toLowerCase());
	const outputFile: string = options.out.toLowerCase();
	const extensions: string[] = options.ext;
	const ignoreGlobs: string[] = options.ignore;
	const outputFormat: string = options.format.toLowerCase();
	const dryRun: boolean = options.dryRun;
	const concurrency: number = options.concurrency;
	const verbose: boolean = options.verbose;

	const spinner = ora({ text: 'Scanning files...', color: 'cyan' }).start();

	async function scanAndWrite() {
		try {
			const comments = await findComments({
				root: rootDirToScan,
				exts: extensions,
				ignore: ignoreGlobs,
				concurrency: concurrency,
				verbose: verbose,
			});
			spinner.succeed(`Scanned. Found ${comments.length} items.`);

			let output = '';
			if (outputFormat === 'json') {
				output = generateJSON(comments);
			} else {
				output = generateMarkdown(comments);
			}

			if (outputFile === '-' || dryRun) {
				console.log(output);
			} else {
				const outPath = resolve(process.cwd(), outputFile);
				await writeFile(outPath, output, {});
				console.log(chalk.green(`Wrote ${outPath}`));
			}
		} catch (error) {
			spinner.fail('Failed');
			console.error(chalk.red((error as Error).message));
			process.exit(2);
		}
	}

	await scanAndWrite();

	process.on('SIGINT', async () => {
		spinner.stop(); // stop the spinner so it doesnt block terminal
		process.exit(0);
	});
}

main();

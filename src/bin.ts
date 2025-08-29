#!/usr/bin/env node

import ora from 'ora';
import { initialProgram } from './utils/program';

async function main() {
	const program = initialProgram();

	const options = program.opts();

	const rootDirToScan: string = options.root.toLowerCase();
	const outputFile: string = options.out.toLowerCase();
	const extensions: string[] = options.ext;
	const ignoreGlobs: string[] = options.ignore;
	const outputFormat: string = options.format.toLowerCase();
	const dryRun: boolean = options.dryRun;
	const concurrency: boolean = options.concurrency;
	const verbose: boolean = options.verbose;

	const spinner = ora({ text: 'Scanning files...', color: 'cyan' }).start();

	async function scanAndWrite() {
		try {
		} catch (error) {}
	}
}

main();

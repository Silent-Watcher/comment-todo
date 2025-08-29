import { Command } from 'commander';
import { version } from '../../package.json';
import {
	DEFAULT_IGNORE_GLOBS,
	DEFAULT_SUPPORTED_EXTS,
} from '../common/constants';

export function initialProgram(): Command {
	const program = new Command();

	program
		.name('comment-todo')
		.version(version)
		.description(
			'Scan repository for TODO/FIXME/HACK comments and generate TODO.md',
		)
		.showHelpAfterError()
		.option('-r, --root <path>', 'project root', '.')
		.option(
			'-o, --out <path>',
			'output file (use "-" for stdout)',
			'TODO.md',
		)
		.option(
			'-e, --ext <list>',
			'comma-separated extensions to include',
			(v: string) => v.split(',').map((s) => s.trim()),
			DEFAULT_SUPPORTED_EXTS,
		)
		.option(
			'-i, --ignore <list>',
			'comma-separated ignore globs',
			(v: string) => v.split(',').map((s) => s.trim()),
			DEFAULT_IGNORE_GLOBS,
		)
		.option(
			'-f, --format <format>',
			'output format (markdown|json)',
			'markdown',
		)
		.option('--dry-run', 'print to stdout, do not write file')
		.option(
			'--concurrency <n>',
			'file read concurrency',
			(v: string) => parseInt(v, 10),
			undefined,
		)
		.option('--verbose', 'verbose logging')
		.parse(process.argv);

	return program;
}

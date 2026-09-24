#!/usr/bin/env node
import { Command } from 'commander';
import { resolve } from 'node:path';

import { scan, DEFAULT_PATTERNS } from './index.js';
import { formatReport } from './report.js';

const program = new Command();

program
  .name('sloplint')
  .description('Catch LLM-authored hallucinated imports and hallucinated standard-library API calls.')
  .version('0.1.0');

program
  .command('check')
  .description('Scan source files for hallucinated imports and hallucinated builtin API calls.')
  .argument('[path]', 'directory to scan (glob patterns are resolved relative to it)', '.')
  .option(
    '-p, --pattern <glob...>',
    `glob pattern(s) to scan, relative to [path] (default: ${DEFAULT_PATTERNS.join(', ')})`,
  )
  .action(async (path: string, options: { pattern?: string[] }) => {
    const cwd = resolve(process.cwd(), path);
    const result = await scan({ cwd, patterns: options.pattern });
    // eslint-disable-next-line no-console
    console.log(formatReport(result, cwd));
    process.exitCode = result.findings.length > 0 ? 1 : 0;
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

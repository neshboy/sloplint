import { relative } from 'node:path';
import chalk from 'chalk';

import type { ScanResult } from './types.js';

const KIND_LABEL: Record<string, string> = {
  'hallucinated-import': 'hallucinated-import',
  'hallucinated-api': 'hallucinated-api',
  'parse-error': 'parse-error',
};

/** Renders a human-readable, itemized report for terminal output. */
export function formatReport(result: ScanResult, cwd: string): string {
  const lines: string[] = [];

  if (result.findings.length === 0) {
    lines.push(chalk.green(`SlopLint: no issues found in ${result.filesScanned} file(s).`));
    if (result.manifestPath) {
      lines.push(chalk.dim(`  (dependencies checked against ${relative(cwd, result.manifestPath)})`));
    }
    return lines.join('\n');
  }

  for (const finding of result.findings) {
    const relPath = relative(cwd, finding.filePath) || finding.filePath;
    const location = `${relPath}:${finding.line}:${finding.column}`;
    const label = KIND_LABEL[finding.kind] ?? finding.kind;
    const color = finding.kind === 'hallucinated-import' ? chalk.red : finding.kind === 'hallucinated-api' ? chalk.yellow : chalk.magenta;

    lines.push(`${color(`[${label}]`)} ${chalk.bold(location)}`);
    if (finding.snippet) {
      lines.push(`  ${chalk.dim(finding.snippet)}`);
    }
    lines.push(`  ${finding.message}`);
    lines.push('');
  }

  const importCount = result.findings.filter((f) => f.kind === 'hallucinated-import').length;
  const apiCount = result.findings.filter((f) => f.kind === 'hallucinated-api').length;
  const parseErrorCount = result.findings.filter((f) => f.kind === 'parse-error').length;

  lines.push(
    chalk.bold(
      `SlopLint: ${result.findings.length} issue(s) found in ${result.filesScanned} file(s) ` +
        `(${importCount} hallucinated import(s), ${apiCount} hallucinated API call(s), ${parseErrorCount} parse error(s)).`,
    ),
  );

  return lines.join('\n');
}

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import fg from 'fast-glob';
import { parse } from '@typescript-eslint/typescript-estree';

import type { Finding, ScanResult } from './types.js';
import { loadProjectManifest } from './manifest.js';
import { checkImports } from './checks/importCheck.js';
import { checkHallucinatedApis } from './checks/apiCheck.js';

export type { Finding, FindingKind, ScanResult } from './types.js';
export { COVERED_MODULES } from './checks/knownApis.js';

export const DEFAULT_PATTERNS = ['src/**/*.{js,jsx,ts,tsx}'];

export interface ScanOptions {
  /** Directory to scan from and to locate the nearest package.json in. */
  cwd: string;
  /** Glob patterns (relative to cwd). Defaults to `src/**\/*.{js,jsx,ts,tsx}`. */
  patterns?: string[];
}

function isJsxLike(filePath: string): boolean {
  return filePath.endsWith('.jsx') || filePath.endsWith('.tsx');
}

/** Scans the given project for hallucinated imports and hallucinated builtin API calls. */
export async function scan(options: ScanOptions): Promise<ScanResult> {
  const cwd = resolve(options.cwd);
  const patterns = options.patterns ?? DEFAULT_PATTERNS;
  const manifest = loadProjectManifest(cwd);

  const files = await fg(patterns, {
    cwd,
    absolute: true,
    onlyFiles: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
  });
  files.sort();

  const findings: Finding[] = [];

  for (const filePath of files) {
    const sourceCode = readFileSync(filePath, 'utf8');
    try {
      const ast = parse(sourceCode, {
        loc: true,
        range: true,
        jsx: isJsxLike(filePath),
        errorOnUnknownASTType: false,
      });
      findings.push(...checkImports(ast, filePath, sourceCode, manifest));
      findings.push(...checkHallucinatedApis(ast, filePath, sourceCode));
    } catch (error) {
      findings.push({
        kind: 'parse-error',
        filePath,
        line: 1,
        column: 1,
        snippet: '',
        message: `Could not parse file: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  findings.sort((a, b) => (a.filePath === b.filePath ? a.line - b.line : a.filePath.localeCompare(b.filePath)));

  return {
    filesScanned: files.length,
    findings,
    manifestPath: manifest.packageJsonPath,
  };
}

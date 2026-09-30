import { describe, expect, it, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { scan } from '../src/index.js';
import type { Finding, ScanResult } from '../src/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureProjectDir = join(here, 'fixtures', 'project');

function findingsFor(result: ScanResult, fileName: string): Finding[] {
  return result.findings.filter((f) => f.filePath.replace(/\\/g, '/').endsWith(fileName));
}

describe('scan()', () => {
  let result: ScanResult;

  beforeAll(async () => {
    result = await scan({ cwd: fixtureProjectDir, patterns: ['src/**/*.{js,ts}'] });
  });

  it('scans all fixture files', () => {
    expect(result.filesScanned).toBe(4);
    expect(result.manifestPath).not.toBeNull();
  });

  describe('hallucinated-import check', () => {
    it('does NOT flag an import of a real Node builtin plus a package actually declared in package.json', () => {
      const findings = findingsFor(result, 'good-import.ts');
      expect(findings.filter((f) => f.kind === 'hallucinated-import')).toHaveLength(0);
    });

    it('flags an import of a package that does not exist / is not declared', () => {
      const findings = findingsFor(result, 'bad-import.ts').filter((f) => f.kind === 'hallucinated-import');
      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('money-formatter-plus-ai');
      expect(findings[0].line).toBe(3);
    });
  });

  describe('hallucinated-api check', () => {
    it('does NOT flag real fs/path methods', () => {
      const findings = findingsFor(result, 'good-api.ts');
      expect(findings.filter((f) => f.kind === 'hallucinated-api')).toHaveLength(0);
    });

    it('flags a made-up fs method that does not exist', () => {
      const findings = findingsFor(result, 'bad-api.ts').filter((f) => f.kind === 'hallucinated-api');
      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('readFileSyncSuperFast');
      expect(findings[0].line).toBe(6);
    });

    it('does NOT flag type-only named imports of covered builtins (import type {...} and import { type X })', () => {
      // good-api.ts imports `PathLike` and `Stats` from 'node:fs', neither of which
      // exists on the runtime API surface - only real named imports should be flagged.
      const findings = findingsFor(result, 'good-api.ts').filter((f) => f.kind === 'hallucinated-api');
      expect(findings).toHaveLength(0);
    });
  });

  it('does not cross-contaminate findings between fixture files', () => {
    // good-import.ts and good-api.ts together should produce zero findings of any kind.
    const goodFindings = [...findingsFor(result, 'good-import.ts'), ...findingsFor(result, 'good-api.ts')];
    expect(goodFindings).toHaveLength(0);
  });
});

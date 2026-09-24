import { describe, expect, it } from 'vitest';

import { extractPackageName } from '../src/checks/importCheck.js';
import { isNodeBuiltin } from '../src/checks/nodeBuiltins.js';
import { isCoveredModule, isKnownApi, COVERED_MODULES } from '../src/checks/knownApis.js';

describe('extractPackageName', () => {
  it('returns null for relative and absolute paths', () => {
    expect(extractPackageName('./foo')).toBeNull();
    expect(extractPackageName('../foo/bar')).toBeNull();
    expect(extractPackageName('/abs/path')).toBeNull();
  });

  it('extracts a plain package name', () => {
    expect(extractPackageName('lodash')).toBe('lodash');
    expect(extractPackageName('lodash/debounce')).toBe('lodash');
  });

  it('extracts scoped package names', () => {
    expect(extractPackageName('@scope/pkg')).toBe('@scope/pkg');
    expect(extractPackageName('@scope/pkg/subpath')).toBe('@scope/pkg');
  });
});

describe('isNodeBuiltin', () => {
  it('recognizes real builtins with and without the node: prefix', () => {
    expect(isNodeBuiltin('fs')).toBe(true);
    expect(isNodeBuiltin('node:fs')).toBe(true);
    expect(isNodeBuiltin('path')).toBe(true);
  });

  it('rejects made-up module names', () => {
    expect(isNodeBuiltin('not-a-real-builtin')).toBe(false);
  });
});

describe('known API surface', () => {
  it('covers exactly the documented set of builtin modules', () => {
    expect(new Set(COVERED_MODULES)).toEqual(new Set(['fs', 'path', 'crypto', 'child_process', 'os']));
  });

  it('accepts real fs/path functions', () => {
    expect(isKnownApi('fs', 'readFileSync')).toBe(true);
    expect(isKnownApi('fs', 'writeFileSync')).toBe(true);
    expect(isKnownApi('path', 'join')).toBe(true);
  });

  it('rejects a fabricated fs method', () => {
    expect(isKnownApi('fs', 'readFileSyncSuperFast')).toBe(false);
  });

  it('never flags modules it does not cover', () => {
    expect(isCoveredModule('lodash')).toBe(false);
    expect(isKnownApi('lodash', 'anythingGoes')).toBe(true);
  });
});

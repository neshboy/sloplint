import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as child_process from 'node:child_process';
import * as os from 'node:os';

import { stripNodePrefix } from './nodeBuiltins.js';

function realFunctionExports(mod: Record<string, unknown>): Set<string> {
  return new Set(Object.keys(mod).filter((key) => typeof mod[key] === 'function'));
}

/**
 * The "known real API surface" for each Node builtin module SlopLint covers
 * in v1. These sets are deliberately NOT hand-typed: they are computed at
 * run time via `Object.keys()` introspection of the actual Node.js builtin
 * module objects imported above. That means the allowlist can never itself
 * drift from reality for whatever Node runtime is executing SlopLint - it
 * is always exactly the real, current function surface for that runtime,
 * which is exactly what we want when the whole point of the tool is to
 * catch *fabricated* API names.
 *
 * v1 intentionally covers only these five modules. See README "Limitations"
 * for why the rest of Node's stdlib and all of npm are out of scope.
 */
export const KNOWN_API_SURFACE: Readonly<Record<string, ReadonlySet<string>>> = {
  fs: realFunctionExports(fs as unknown as Record<string, unknown>),
  path: realFunctionExports(path as unknown as Record<string, unknown>),
  crypto: realFunctionExports(crypto as unknown as Record<string, unknown>),
  child_process: realFunctionExports(child_process as unknown as Record<string, unknown>),
  os: realFunctionExports(os as unknown as Record<string, unknown>),
};

export const COVERED_MODULES: readonly string[] = Object.keys(KNOWN_API_SURFACE);

export function normalizeModuleName(name: string): string {
  return stripNodePrefix(name);
}

export function isCoveredModule(name: string): boolean {
  return normalizeModuleName(name) in KNOWN_API_SURFACE;
}

/**
 * Returns true if `methodName` is a real, documented function exported by
 * `moduleName`. For modules SlopLint does not cover, this always returns
 * true (i.e. "not known to be wrong") so we never flag things we can't
 * actually verify.
 */
export function isKnownApi(moduleName: string, methodName: string): boolean {
  const normalized = normalizeModuleName(moduleName);
  const surface = KNOWN_API_SURFACE[normalized];
  if (!surface) return true;
  return surface.has(methodName);
}

import { builtinModules } from 'node:module';

/**
 * The real set of Node.js builtin module names, taken directly from
 * `node:module`'s own `builtinModules` list (not hand-typed). Internal
 * modules prefixed with "_" are excluded since they aren't part of the
 * public API surface an import statement could legitimately target.
 */
export const NODE_BUILTIN_MODULES: ReadonlySet<string> = new Set(
  builtinModules.filter((name) => !name.startsWith('_')),
);

/** Strips a leading "node:" prefix, e.g. "node:fs" -> "fs". */
export function stripNodePrefix(moduleName: string): string {
  return moduleName.startsWith('node:') ? moduleName.slice('node:'.length) : moduleName;
}

/** Whether `moduleName` (with or without a "node:" prefix) is a real Node builtin. */
export function isNodeBuiltin(moduleName: string): boolean {
  return NODE_BUILTIN_MODULES.has(stripNodePrefix(moduleName));
}

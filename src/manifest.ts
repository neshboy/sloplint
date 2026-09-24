import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export interface ProjectManifest {
  /** Absolute path to the package.json used, or null if none was found. */
  packageJsonPath: string | null;
  /** Union of dependencies/devDependencies/optionalDependencies/peerDependencies. */
  declaredDependencies: ReadonlySet<string>;
}

interface RawPackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

/**
 * Walks up from `startDir` looking for the nearest package.json and returns
 * the real set of declared dependency names from it. This is the source of
 * truth the import check compares against - no guessing, no hardcoded
 * "popular package" lists.
 */
export function loadProjectManifest(startDir: string): ProjectManifest {
  let dir = resolve(startDir);

  for (;;) {
    const candidate = join(dir, 'package.json');
    if (existsSync(candidate)) {
      let raw: RawPackageJson;
      try {
        raw = JSON.parse(readFileSync(candidate, 'utf8')) as RawPackageJson;
      } catch {
        return { packageJsonPath: candidate, declaredDependencies: new Set() };
      }
      const names = new Set<string>([
        ...Object.keys(raw.dependencies ?? {}),
        ...Object.keys(raw.devDependencies ?? {}),
        ...Object.keys(raw.optionalDependencies ?? {}),
        ...Object.keys(raw.peerDependencies ?? {}),
      ]);
      return { packageJsonPath: candidate, declaredDependencies: names };
    }

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return { packageJsonPath: null, declaredDependencies: new Set() };
}

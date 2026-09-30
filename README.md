# SlopLint

SlopLint is a static-analysis linter purpose-built to catch the two most common, embarrassing classes of LLM-authored code bugs:

1. **Hallucinated imports** - `import`/`require` of a package that was never added to `package.json` (or that doesn't exist at all), because the agent that wrote the code "remembered" a package name that isn't actually a real dependency.
2. **Hallucinated APIs** - calls to methods that don't exist on well-known Node.js builtin objects, because the agent confidently invented a plausible-sounding method name.

SlopLint does real AST parsing (via `@typescript-eslint/typescript-estree`) of your actual source files and checks the result against your actual `package.json` and the actual, introspected API surface of a curated set of Node builtins. It is not a heuristic score and it does not read git metadata - it reads code.

## How this differs from `slopgate` and `typosquatwatch`

These are three separate, complementary tools from the same author's portfolio:

- **`slopgate`** scores whole pull requests using metadata heuristics (diff size, description quality, etc.) - it never looks at what the code actually does.
- **`typosquatwatch`** checks dependency *names* in your manifest for typosquatting (e.g. `lodash` vs `1odash`) - it doesn't care whether your code's imports match your manifest, or whether the APIs you call exist.
- **`sloplint`** (this project) does real static analysis of the *code itself*: it parses an AST, walks every import/require to see if the imported package is real and declared, and walks every call to a covered Node builtin to see if the method actually exists. It's the only one of the three that catches "the agent imported a package that doesn't exist" or "the agent called `fs.readFileSyncSuperFast()`."

## Install / quick start

```bash
npm install
npm run build
npx sloplint check [path]
```

Or during development, without building first:

```bash
npm run dev -- check [path]
```

By default `sloplint check` scans `src/**/*.{js,jsx,ts,tsx}` relative to `[path]` (which itself defaults to the current directory), finds the nearest `package.json` by walking up from there, and reports every finding with a non-zero exit code if anything was flagged - so it plugs straight into CI:

```bash
sloplint check src
```

Custom glob patterns:

```bash
sloplint check . --pattern "lib/**/*.ts" --pattern "scripts/**/*.js"
```

## Example report output

Given a file that imports a package nobody added to `package.json` and calls a method that doesn't exist on `fs`:

```
[hallucinated-api] src/bad-api.ts:6:10
  fs.readFileSyncSuperFast(filePath, 'utf8')
  "fs.readFileSyncSuperFast" is not a real exported function of Node's "fs" module (checked against the actual runtime API surface).

[hallucinated-import] src/bad-import.ts:3:1
  import { formatCurrency } from 'money-formatter-plus-ai';
  Package "money-formatter-plus-ai" is not a Node builtin and is not listed in dependencies/devDependencies of /path/to/package.json.

SlopLint: 2 issue(s) found in 4 file(s) (1 hallucinated import(s), 1 hallucinated API call(s), 0 parse error(s)).
```

Exit code is `1` whenever at least one issue is found, `0` otherwise.

## How the checks work

### Hallucinated-import check

SlopLint AST-walks `import`/`export ... from`/dynamic `import()`/`require()` statements, extracts the package name from each source string (handling scoped `@scope/pkg` names and subpath imports like `lodash/debounce`), and skips relative/local imports (`./foo`). What's left is checked against:

- The real Node.js builtin module list, taken directly from `node:module`'s own `builtinModules` (not hand-typed).
- The real `dependencies`/`devDependencies`/`optionalDependencies`/`peerDependencies` declared in the nearest `package.json`.

Anything that's neither is flagged as a likely hallucinated import.

### Hallucinated-API check

SlopLint ships a curated, **introspected** "known API surface" for five Node builtin modules: **`fs`, `path`, `crypto`, `child_process`, and `os`**. Crucially, these allowlists are not hand-typed guesses - they are computed at run time via `Object.keys()` on the actual builtin module objects (`node:fs`, `node:path`, etc.) for whatever Node version is running SlopLint. That means the allowlist can never itself be wrong or drift out of date.

SlopLint then tracks simple local aliases created via `import fs from 'fs'`, `import * as fs from 'fs'`, and `const fs = require('fs')` (plus named imports/destructures like `import { readFile } from 'fs'` or `const { readFile } = require('fs')`), and flags:

- `alias.someMethod(...)` calls where `someMethod` isn't a real export of the aliased module.
- Named imports/destructured properties that aren't real exports of the module.

## Limitations

Be honest about what this MVP does *not* do:

- **The hallucinated-API check only covers five Node builtin modules: `fs`, `path`, `crypto`, `child_process`, and `os`.** It does not check any other Node builtin (`http`, `stream`, `events`, ...) and it does not check the API surface of *any* npm package (React, Express, lodash, etc.) - enumerating every npm package's real API surface is out of scope for a v1. Calls on uncovered modules/packages are never flagged (SlopLint only flags what it can actually verify).
- **The import check can't catch dynamic/computed import paths.** `require(someVariable)`, `require(\`pkg-${name}\`)`, or `import(getModuleName())` cannot be statically resolved to a package name, so SlopLint silently skips them rather than guessing.
- Alias tracking for the API check is intentionally simple and per-file: it does not do full scope analysis, so shadowed variables, re-exported aliases, or `require('fs').someMethod()` used through several layers of indirection may not be tracked correctly. Direct `require('fs').method()` chains and single-level local aliases are supported.
- Only `.js`/`.jsx`/`.ts`/`.tsx` files are parsed. Files that fail to parse are reported as a `parse-error` finding rather than crashing the whole scan, but they aren't otherwise analyzed.
- The dependency manifest check only looks at `package.json`; it doesn't cross-check lockfiles or actually resolve packages from `node_modules`.
- **The hallucinated-API check's "known API surface" is built from runtime `Object.keys()`, so it only knows about values, never TypeScript types.** Explicit type-only imports (`import type { PathLike } from 'node:fs'`, or `import { type PathLike } from 'node:fs'`) are recognized via the AST's `importKind` and skipped. But an implicit type-only import written *without* the `type` keyword (e.g. `import { PathLike } from 'fs'`) is indistinguishable at the AST level from a real hallucinated value import, and may still be flagged as a false positive.

## Development

```bash
npm install
npm run build      # compile TypeScript to dist/
npm test           # run the vitest suite (uses fixtures in test/fixtures/project)
npm run dev -- check <path>   # run the CLI directly from source via tsx
```

## License

MIT - see [LICENSE](./LICENSE).

import { simpleTraverse } from '@typescript-eslint/typescript-estree';
import type { TSESTree } from '@typescript-eslint/typescript-estree';

import type { Finding } from '../types.js';
import type { ProjectManifest } from '../manifest.js';
import { isNodeBuiltin } from './nodeBuiltins.js';

/**
 * Extracts the installable package name from an import/require path.
 * Returns null for relative/absolute paths, which are local files and are
 * never checked against the dependency manifest.
 */
export function extractPackageName(importPath: string): string | null {
  if (importPath.startsWith('.') || importPath.startsWith('/')) return null;
  if (importPath.startsWith('node:')) return importPath;
  const segments = importPath.split('/');
  if (importPath.startsWith('@')) {
    return segments.slice(0, 2).join('/');
  }
  return segments[0] ?? null;
}

function snippetFor(sourceCode: string, node: TSESTree.Node): string {
  if (!node.range) return '';
  return sourceCode.slice(node.range[0], node.range[1]).split('\n')[0].trim();
}

/**
 * Walks the AST for import/require sources and flags any that point at a
 * package that is neither a real Node builtin nor declared in the
 * project's package.json.
 */
export function checkImports(
  ast: TSESTree.Program,
  filePath: string,
  sourceCode: string,
  manifest: ProjectManifest,
): Finding[] {
  const findings: Finding[] = [];

  function evaluate(importPath: unknown, node: TSESTree.Node): void {
    if (typeof importPath !== 'string') return;
    const pkgName = extractPackageName(importPath);
    if (!pkgName) return; // relative/local import - not our concern
    if (isNodeBuiltin(pkgName)) return;
    if (manifest.declaredDependencies.has(pkgName)) return;

    findings.push({
      kind: 'hallucinated-import',
      filePath,
      line: node.loc.start.line,
      column: node.loc.start.column + 1,
      snippet: snippetFor(sourceCode, node),
      message: manifest.packageJsonPath
        ? `Package "${pkgName}" is not a Node builtin and is not listed in dependencies/devDependencies of ${manifest.packageJsonPath}.`
        : `Package "${pkgName}" is not a Node builtin and no package.json was found to verify it against.`,
    });
  }

  simpleTraverse(ast, {
    enter: (node) => {
      switch (node.type) {
        case 'ImportDeclaration':
        case 'ExportNamedDeclaration':
        case 'ExportAllDeclaration': {
          if (node.source) evaluate(node.source.value, node);
          break;
        }
        case 'ImportExpression': {
          if (node.source.type === 'Literal') evaluate(node.source.value, node);
          break;
        }
        case 'TSImportEqualsDeclaration': {
          const ref = node.moduleReference;
          if (ref.type === 'TSExternalModuleReference' && ref.expression.type === 'Literal') {
            evaluate(ref.expression.value, node);
          }
          break;
        }
        case 'CallExpression': {
          if (
            node.callee.type === 'Identifier' &&
            node.callee.name === 'require' &&
            node.arguments.length > 0 &&
            node.arguments[0].type === 'Literal'
          ) {
            evaluate(node.arguments[0].value, node);
          }
          break;
        }
        default:
          break;
      }
    },
  });

  return findings;
}

import { simpleTraverse } from '@typescript-eslint/typescript-estree';
import type { TSESTree } from '@typescript-eslint/typescript-estree';

import type { Finding } from '../types.js';
import { isCoveredModule, isKnownApi, normalizeModuleName } from './knownApis.js';

interface AliasBinding {
  /** Normalized module name, e.g. "fs". */
  moduleName: string;
}

function snippetFor(sourceCode: string, node: TSESTree.Node): string {
  if (!node.range) return '';
  return sourceCode.slice(node.range[0], node.range[1]).split('\n')[0].trim();
}

/** If `node` is `require("literal")`, returns the literal string. Otherwise null. */
function getRequireModuleName(node: TSESTree.Node | null | undefined): string | null {
  if (!node) return null;
  if (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'require' &&
    node.arguments.length > 0 &&
    node.arguments[0].type === 'Literal' &&
    typeof node.arguments[0].value === 'string'
  ) {
    return node.arguments[0].value;
  }
  return null;
}

/**
 * Walks the AST looking for `moduleAlias.someMethod(...)` calls (and named
 * imports / destructured requires) against the small set of Node builtin
 * modules SlopLint has a real, introspected API surface for, and flags any
 * method/property name that doesn't actually exist on that module.
 */
export function checkHallucinatedApis(
  ast: TSESTree.Program,
  filePath: string,
  sourceCode: string,
): Finding[] {
  const findings: Finding[] = [];
  const aliases = new Map<string, AliasBinding>();

  function recordAlias(localName: string, moduleSource: string): void {
    const normalized = normalizeModuleName(moduleSource);
    if (isCoveredModule(normalized)) {
      aliases.set(localName, { moduleName: normalized });
    }
  }

  function pushFinding(
    node: TSESTree.Node,
    moduleName: string,
    methodName: string,
    kind: 'call' | 'named-import',
  ): void {
    const message =
      kind === 'call'
        ? `"${moduleName}.${methodName}" is not a real exported function of Node's "${moduleName}" module (checked against the actual runtime API surface).`
        : `"${methodName}" is not a real export of Node's "${moduleName}" module - this named import/destructure looks hallucinated.`;

    findings.push({
      kind: 'hallucinated-api',
      filePath,
      line: node.loc.start.line,
      column: node.loc.start.column + 1,
      snippet: snippetFor(sourceCode, node),
      message,
    });
  }

  function checkNamedBindings(
    moduleSource: string,
    bindings: Array<{ imported: string; node: TSESTree.Node }>,
  ): void {
    const normalized = normalizeModuleName(moduleSource);
    if (!isCoveredModule(normalized)) return;
    for (const { imported, node } of bindings) {
      if (!isKnownApi(normalized, imported)) {
        pushFinding(node, normalized, imported, 'named-import');
      }
    }
  }

  simpleTraverse(ast, {
    enter: (node) => {
      switch (node.type) {
        case 'ImportDeclaration': {
          const moduleSource = node.source.value;
          if (typeof moduleSource !== 'string') break;
          for (const spec of node.specifiers) {
            if (spec.type === 'ImportDefaultSpecifier' || spec.type === 'ImportNamespaceSpecifier') {
              recordAlias(spec.local.name, moduleSource);
            } else if (spec.type === 'ImportSpecifier') {
              const importedName =
                spec.imported.type === 'Identifier' ? spec.imported.name : String(spec.imported.value);
              checkNamedBindings(moduleSource, [{ imported: importedName, node: spec }]);
            }
          }
          break;
        }
        case 'VariableDeclarator': {
          const requireSource = getRequireModuleName(node.init);
          if (!requireSource) break;
          if (node.id.type === 'Identifier') {
            recordAlias(node.id.name, requireSource);
          } else if (node.id.type === 'ObjectPattern') {
            const bindings: Array<{ imported: string; node: TSESTree.Node }> = [];
            for (const prop of node.id.properties) {
              if (prop.type === 'Property' && prop.key.type === 'Identifier') {
                bindings.push({ imported: prop.key.name, node: prop });
              }
            }
            checkNamedBindings(requireSource, bindings);
          }
          break;
        }
        case 'CallExpression': {
          if (
            node.callee.type === 'MemberExpression' &&
            !node.callee.computed &&
            node.callee.property.type === 'Identifier'
          ) {
            const methodName = node.callee.property.name;
            let moduleName: string | null = null;

            if (node.callee.object.type === 'Identifier') {
              const binding = aliases.get(node.callee.object.name);
              if (binding) moduleName = binding.moduleName;
            } else {
              const directRequire = getRequireModuleName(node.callee.object);
              if (directRequire) {
                const normalized = normalizeModuleName(directRequire);
                if (isCoveredModule(normalized)) moduleName = normalized;
              }
            }

            if (moduleName && !isKnownApi(moduleName, methodName)) {
              pushFinding(node, moduleName, methodName, 'call');
            }
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

// @ts-check

import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parse as esParse } from 'espree';
import { traverse } from 'estraverse';

export class HashCopiedPath {
  /**
   * @param {string} hashedFilePath
   * @param {Iterable<string>} dependencies
   */
  constructor(hashedFilePath, dependencies) {
    this.hashedFilePath = hashedFilePath;
    this.dependencies = new Set(dependencies);
  }
}

/**
 * @param {string} scriptSource
 * @param {string|URL} importerUrl
 * @param {URL} publicDirectory
 */
function findImports(scriptSource, importerUrl, publicDirectory) {
  /** @type {Set<string>} */
  const dependencies = new Set();

  traverse(esParse(scriptSource, { ecmaVersion: 2022, sourceType: 'module' }), {
    enter(node) {
      // The target of an import expression can't always be known statically,
      // but when it is a plain string we can use it. It may be worth adding or
      // using an ESLint rule to enforce `import()` only receives plain strings.
      if (node.type === 'ImportDeclaration' || node.type === 'ImportExpression') {
        if (node.source.type === 'Literal' && typeof node.source.value === 'string') {
          dependencies.add(new URL(node.source.value, importerUrl).pathname.slice(publicDirectory.pathname.length - 1));
        }
      }
    }
  });

  return dependencies;
}

/**
 * @param {URL} publicDirectory
 * @param {URL} sourceFile
 * @param {URL} targetDirectory
 * @return {Promise<[string, HashCopiedPath]>}
 */
export default async function hashCopy(publicDirectory, sourceFile, targetDirectory) {
  const content = await readFile(sourceFile);
  const hash = createHash('sha256')
    .update(content)
    .digest('hex');
  const originalFilename = sourceFile.pathname.split('/').pop() || '';
  const parts = originalFilename.split('.');

  parts[parts.length - 2] = `hashed-${parts[parts.length - 2]}-${hash}`;

  const hashedFileName = parts.join('.');
  const target = new URL(hashedFileName, targetDirectory);

  await writeFile(target, content);

  const hashedFilePath = target.pathname.slice(publicDirectory.pathname.length - 1);
  const dependencies = findImports(content.toString(), target, publicDirectory);

  return [
    new URL(originalFilename, targetDirectory).pathname.slice(publicDirectory.pathname.length - 1),
    new HashCopiedPath(hashedFilePath, dependencies)
  ];
}

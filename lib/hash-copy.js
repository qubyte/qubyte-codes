import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parse as esParse } from 'espree';
import { traverse } from 'estraverse';

function findImports(scriptSource, importerHref, publicDirectory) {
  const dependencies = [];
  const tree = esParse(scriptSource, { ecmaVersion: 2022, sourceType: 'module' });

  traverse(tree, {
    enter({ type, source }) {
      // The target of an import expression can't always be known statically,
      // but when it is a plain string we can use it. It may be worth adding or
      // using an ESLint rule to enforce `import()` only receives plain strings.
      if (type === 'ImportDeclaration' || (type === 'ImportExpression' && typeof source?.value === 'string')) {
        dependencies.push(new URL(source.value, importerHref).pathname.slice(publicDirectory.pathname.length - 1));
      }
    }
  });

  return dependencies;
}

/**
 * @param {URL} publicDirectory
 * @param {URL} sourceFile
 * @param {URL} targetDirectory
 */
export default async function hashCopy(publicDirectory, sourceFile, targetDirectory) {
  const content = await readFile(sourceFile);
  const hash = createHash('sha256')
    .update(content)
    .digest('hex');
  const originalFilename = sourceFile.pathname.split('/').pop();
  const parts = originalFilename.split('.');

  parts[parts.length - 2] = `hashed-${parts[parts.length - 2]}-${hash}`;

  const hashedFileName = parts.join('.');
  const target = new URL(hashedFileName, targetDirectory);

  await writeFile(target, content);

  return [
    new URL(originalFilename, targetDirectory).pathname.slice(publicDirectory.pathname.length - 1),
    {
      hashedFilePath: target.pathname.slice(publicDirectory.pathname.length - 1),
      dependencies: findImports(content.toString(), target, publicDirectory)
    }
  ];
}

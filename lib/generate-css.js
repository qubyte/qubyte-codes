import { createHash } from 'node:crypto';
import { readdir, writeFile } from 'node:fs/promises';

import postcss from 'postcss';
import postcssImport from 'postcss-import';
import cssnano from 'cssnano';

async function renderCss(paths) {
  const { css } = await postcss([
    postcssImport(),
    cssnano({ preset: ['default', { mergeLonghand: false }] })
  ]).process(
    paths.map(p => `@import url('${p.pathname}');`).join('\n'),
    { from: undefined }
  );

  const hash = createHash('md5')
    .update(css)
    .digest('hex');

  return { content: css, hash };
}

export async function generateSpecificCss(directory, targetDirectory) {
  const dir = await readdir(directory);

  /** @type {Map<string, string>} */
  const mapEntries = new Map();

  await Promise.all(dir.map(async filename => {
    if (!filename.endsWith('.css')) {
      return;
    }

    const entryFile = new URL(filename, directory);
    const { content, hash } = await renderCss([entryFile]);

    const hashedFilename = `hashed-${filename.slice(0, -4)}-${hash}.css`;
    const cssPath = new URL(hashedFilename, targetDirectory);

    await writeFile(cssPath, content);

    mapEntries.set(`/styles/${filename}`, `/styles/${hashedFilename}`);
  }));

  return mapEntries;
}

// Compiles and calculates a unique filename for CSS.
export async function generateMainCss({ entry, targetDirectory, codeStyle = 'default' }) {
  const codeStyleFile = new URL(`../node_modules/highlight.js/styles/${codeStyle}.css`, import.meta.url);

  const { content, hash } = await renderCss([entry, codeStyleFile]);

  const hashedFilename = `hashed-main-${hash}.css`;
  const cssUrl = new URL(hashedFilename, targetDirectory);

  await writeFile(cssUrl, content);

  return {
    url: cssUrl,
    htmlPath: `/${hashedFilename}`
  };
}

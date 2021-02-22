import crypto from 'crypto';
import { promises as fs } from 'fs';
import postcss from 'postcss';
import postcssImport from 'postcss-import';
import postCssPresetEnv from 'postcss-preset-env';
import postCssCalc from 'postcss-calc';
import customProperties from 'postcss-custom-properties';
import cssnano from 'cssnano';

async function renderCss(paths) {
  const { css } = await postcss([
    postcssImport(),
    postCssPresetEnv(),
    customProperties({ preserve: true }),
    postCssCalc(),
    cssnano({ preset: 'default' })
  ]).process(
    paths.map(p => `@import url('${p.pathname}');`).join('\n'),
    { from: undefined }
  );

  const hash = crypto
    .createHash('md5')
    .update(css)
    .digest('hex');

  return { content: css, hash };
}

export async function generateSpecificCss(directory, targetDirectory) {
  const dir = await fs.readdir(directory);

  const mapEntries = await Promise.all(dir.map(async filename => {
    if (!filename.endsWith('.css')) {
      return null;
    }

    const entryFile = new URL(filename, directory);
    const { content, hash } = await renderCss([entryFile]);

    const hashedFilename = `${filename.slice(0, -4)}-${hash}.css`;
    const cssPath = new URL(hashedFilename, targetDirectory);

    await fs.writeFile(cssPath, content);

    return [`/styles/${filename}`, `/styles/${hashedFilename}`];
  }));

  return new Map(mapEntries.filter(Boolean));
}

// Compiles and calculates a unique filename for CSS.
export async function generateMainCss(entry, targetDirectory, codeStyle = 'default') {
  const codeStyleFile = new URL(`../node_modules/highlight.js/styles/${codeStyle}.css`, import.meta.url);

  const { content, hash } = await renderCss([entry, codeStyleFile]);

  const hashedFilename = `main-${hash}.css`;
  const cssPath = new URL(hashedFilename, targetDirectory);

  await fs.writeFile(cssPath, content);

  return `/${hashedFilename}`;
}

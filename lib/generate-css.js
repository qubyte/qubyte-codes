import crypto from 'crypto';
import { promises as fs } from 'fs';
import postcss from 'postcss';
import postcssImport from 'postcss-import';
import postCssPresetEnv from 'postcss-preset-env';
import postCssCalc from 'postcss-calc';
import customProperties from 'postcss-custom-properties';
import cssnano from 'cssnano';
import path from 'path';
import { fileURLToPath } from 'url';

async function renderCss(directory, paths) {
  const { css } = await postcss([
    postcssImport({ path: directory }),
    postCssPresetEnv(),
    customProperties({ preserve: true }),
    postCssCalc(),
    cssnano({ preset: 'default' })
  ]).process(
    paths.map(p => `@import url('${p}');`).join('\n'),
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

    const { content, hash } = await renderCss(directory, [path.join(directory, filename)]);

    const hashedFilename = `${filename.slice(0, -4)}-${hash}.css`;
    const cssPath = path.join(targetDirectory, hashedFilename);

    await fs.writeFile(cssPath, content);

    return [`/styles/${filename}`, `/styles/${hashedFilename}`];
  }));

  return new Map(mapEntries.filter(Boolean));
}

// Compiles and calculates a unique filename for CSS.
export async function generateMainCss(directory, targetDirectory, filename, codeStyle = 'default') {
  const codeStyleFile = fileURLToPath(new URL(`../node_modules/highlight.js/styles/${codeStyle}.css`, import.meta.url));

  const { content, hash } = await renderCss(directory, [filename, codeStyleFile]);

  const hashedFilename = `main-${hash}.css`;
  const cssPath = path.join(targetDirectory, hashedFilename);

  await fs.writeFile(cssPath, content);

  return `/${hashedFilename}`;
}

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

// Compiles and calculates a unique filename for CSS.
export default async function generateCss(directory, targetDirectory, filename, codeStyle = 'default') {
  const codeStyleFile = fileURLToPath(new URL(`../node_modules/highlight.js/styles/${codeStyle}.css`, import.meta.url));

  const { css } = await postcss([
    postcssImport({ path: directory }),
    postCssPresetEnv(),
    customProperties({ preserve: true }),
    postCssCalc(),
    cssnano({ preset: 'default' })
  ]).process(`
    @import url('${filename}');
    @import url('${codeStyleFile}')
  `, { from: undefined });

  const hash = crypto
    .createHash('md5')
    .update(css)
    .digest('hex');

  const hashedFilename = `main-${hash}.css`;
  const cssPath = path.join(targetDirectory, hashedFilename);

  await fs.writeFile(cssPath, css);

  return `/${hashedFilename}`;
}

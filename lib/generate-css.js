'use strict';

const crypto = require('crypto');
const fs = require('fs').promises;
const postcss = require('postcss');
const postcssImport = require('postcss-import');
const postCssPresetEnv = require('postcss-preset-env');
const postCssCalc = require('postcss-calc');
const customProperties = require('postcss-custom-properties');
const cssnano = require('cssnano');
const path = require('path');

// Compiles and calculates a unique filename for CSS.
module.exports = async function generateCss(directory, targetDirectory, filename, codeStyle = 'default') {
  const { css } = await postcss([
    postcssImport({ path: directory }),
    postCssPresetEnv(),
    customProperties({ preserve: true }),
    postCssCalc(),
    cssnano({ preset: 'default' })
  ]).process(`
    @import url('${filename}');
    @import url('${require.resolve(`highlight.js/styles/${codeStyle}.css`)}')
  `, { from: undefined });

  const hash = crypto
    .createHash('md5')
    .update(css)
    .digest('hex');

  const hashedFilename = `main-${hash}.css`;
  const cssPath = path.join(targetDirectory, hashedFilename);

  await fs.writeFile(cssPath, css);

  return `/${hashedFilename}`;
};

'use strict';

const crypto = require('crypto');
const fs = require('fs').promises;
const postcss = require('postcss');
const postcssImport = require('postcss-import');
const postCssPresetEnv = require('postcss-preset-env');
const postCssCalc = require('postcss-calc');
const customProperties = require('postcss-custom-properties');
const cssnano = require('cssnano');
const buildPaths = require('./build-paths');

// Compiles and calculates a unique filename for CSS.
module.exports = async function generateCss(directory, filename) {
  const { css } = await postcss([
    postcssImport({ path: directory }),
    postCssPresetEnv(),
    customProperties({ preserve: false }),
    postCssCalc(),
    cssnano({ preset: 'default' })
  ]).process(`@import url('${filename}')\n`, { from: undefined });

  const hash = crypto
    .createHash('md5')
    .update(css)
    .digest('hex');

  const cssPath = buildPaths.public(`main-${hash}.css`);

  await fs.writeFile(cssPath, css);

  return `/main-${hash}.css`;
};

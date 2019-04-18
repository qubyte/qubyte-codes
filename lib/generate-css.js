'use strict';

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const postcss = require('postcss');
const postcssImport = require('postcss-import');
const postCssPresetEnv = require('postcss-preset-env');
const postCssCalc = require('postcss-calc');
const customProperties = require('postcss-custom-properties');
const cssnano = require('cssnano');
const buildPaths = require('./build-paths');

// Compiles and calculates a unique filename for CSS.
module.exports = async function generateCss(directory, filename, codeStyle = 'default') {
  const { css } = await postcss([
    postcssImport({ path: directory }),
    postCssPresetEnv(),
    customProperties({ preserve: true }),
    postCssCalc(),
    cssnano({ preset: 'default' })
  ]).process(`
    @import url('${filename}');
    @import url('${path.join(process.cwd(), 'node_modules', 'highlight.js', 'styles', `${codeStyle}.css`)}')
  `, { from: undefined });

  const hash = crypto
    .createHash('md5')
    .update(css)
    .digest('hex');

  const cssPath = buildPaths.public(`main-${hash}.css`);

  await fs.writeFile(cssPath, css);

  return `/main-${hash}.css`;
};

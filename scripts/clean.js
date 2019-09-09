'use strict';

/* eslint no-console: off */

console.log('Cleaning build artefacts...');
console.time('Done cleaning.');

const { rmdir } = require('fs').promises;
const { join } = require('path');

rmdir(join(__dirname, '..', 'public'), { recursive: true })
  .then(() => console.timeEnd('Done cleaning.'));

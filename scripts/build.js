'use strict';

const blogEngine = require('..');
const baseUrl = process.argv[2];
const devMode = process.argv.includes('--dev');

blogEngine.build(baseUrl, devMode).catch(e => {
  console.error(e); // eslint-disable-line no-console
  process.exit(1);
});

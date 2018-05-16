'use strict';

const blogEngine = require('./');
const baseUrl = process.argv[2];
const devMode = process.argv.includes('--dev');
const compileCss = !process.argv.includes('--no-css-compile');

blogEngine.build(baseUrl, devMode, compileCss).catch(e => {
  console.error(e.stack); // eslint-disable-line no-console
  process.exit(1);
});

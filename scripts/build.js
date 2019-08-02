'use strict';

const blogEngine = require('..');
const baseUrl = process.argv[2] || process.env.URL;

blogEngine.build(baseUrl).catch(e => {
  console.error(e); // eslint-disable-line no-console
  process.exit(1);
});

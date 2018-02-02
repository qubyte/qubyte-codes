'use strict';

const blogEngine = require('./');
const baseUrl = process.argv[2];

blogEngine.build(baseUrl).catch(e => {
  console.error(e.stack); // eslint-disable-line no-console
  process.exit(1);
});

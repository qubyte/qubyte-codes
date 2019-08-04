'use strict';

const blogEngine = require('..');
const baseUrl = process.argv[2] || process.env.URL;
const baseTitle =  process.argv[3] || process.env.BASE_TITLE;

blogEngine.build({ baseUrl, baseTitle }).catch(e => {
  console.error(e); // eslint-disable-line no-console
  process.exit(1);
});

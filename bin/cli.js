#!/usr/bin/env node

'use strict';

const blogEngine = require('../');

blogEngine.build().catch(e => {
  console.error(e.stack); // eslint-disable-line no-console
  process.exit(1);
});

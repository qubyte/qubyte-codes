#!/usr/bin/env node

'use strict';

const blogEngine = require('../');

async function run() {
  try {
    await blogEngine.build();
  } catch (e) {
    console.error(e.stack); // eslint-disable-line no-console
    process.exit(1);
  }
}

run();

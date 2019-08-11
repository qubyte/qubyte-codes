'use strict';

/* eslint-disable no-console */

const fetch = require('node-fetch');

fetch(process.env.NETLIFY_BUILD_HOOK_URL, { method: 'POST' })
  .then(async res => {
    if (!res.ok) {
      throw new Error(`Error making request to Netlify ${res.status}: ${await res.text()}`);
    }

    console.log('Sent build hook request to Netlify.');
  })
  .catch(error => {
    console.error(error.stack || error.message);
    process.exit(1);
  });

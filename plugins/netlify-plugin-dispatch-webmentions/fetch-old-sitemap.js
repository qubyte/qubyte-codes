'use strict';

const fetch = require('node-fetch');
const retry = require('p-retry');

async function getSiteMap() {
  const url = `${process.env.URL}/sitemap.txt`;
  const res = await fetch(url);
  const body = await res.text();

  if (!res.ok) {
    throw new Error(`Unexpected response from ${url} ${body}`);
  }

  return body;
}

module.exports = () => retry(getSiteMap, { retries: 5 });

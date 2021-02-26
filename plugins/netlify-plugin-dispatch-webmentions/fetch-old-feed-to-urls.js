'use strict';

const fetch = require('node-fetch');
const retry = require('p-retry');
const parseFeedToUrls = require('./parse-feed-to-urls');

async function fetchOldFeed(url) {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Unexpected response from ${url}: ${res.status} ${await res.text()}`);
  }

  return parseFeedToUrls(res.body);
}

module.exports = url => retry(() => fetchOldFeed(url), { retries: 5 });

'use strict';

const parseFeedToUrls = require('./parse-feed-to-urls');

async function fetchOldFeed(url) {
  const { default: fetch } = await import('node-fetch');
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Unexpected response from ${url}: ${res.status} ${await res.text()}`);
  }

  return parseFeedToUrls(res.body);
}

module.exports = async url => {
  const retry = await import('p-retry');
  return retry(() => fetchOldFeed(url), { retries: 5 });
};

import fetch from 'node-fetch';
import retry from 'p-retry';
import parseFeedToUrls from './parse-feed-to-urls';

async function fetchOldFeed(url) {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Unexpected response from ${url}: ${res.status} ${await res.text()}`);
  }

  return parseFeedToUrls(res.body);
}

export default url => retry(() => fetchOldFeed(url), { retries: 5 });

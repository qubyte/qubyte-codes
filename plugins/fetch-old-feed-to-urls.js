import { Readable } from 'node:stream';
import { fetch } from 'undici';
import retry from 'p-retry';
import parseFeedToUrls from './parse-feed-to-urls.js';

async function fetchOldFeed(url) {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Unexpected response from ${url}: ${res.status} ${await res.text()}`);
  }

  return parseFeedToUrls(Readable.fromWeb(res.body));
}

export default function (url) {
  return retry(() => fetchOldFeed(url), { retries: 5 });
}

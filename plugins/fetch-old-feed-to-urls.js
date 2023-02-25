import { Readable } from 'node:stream';
import parseFeedToUrls from './parse-feed-to-urls.js';
import retry from '../lib/linear-retry.js';

export default function fetchOldFeedToUrls(url) {
  async function fetchOldFeed() {
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Unexpected response from ${url}: ${res.status} ${await res.text()}`);
    }

    return parseFeedToUrls(Readable.fromWeb(res.body));
  }

  return retry(fetchOldFeed, 5);
}

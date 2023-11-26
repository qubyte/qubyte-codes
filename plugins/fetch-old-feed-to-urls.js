// @ts-check

import { Readable } from 'node:stream';
import parseFeedToUrls from './parse-feed-to-urls.js';
import retry from '../lib/linear-retry.js';

/** @param {URL} url */
export default function fetchOldFeedToUrls(url) {
  /** @returns {Promise<Map<string, Date>>} */
  async function fetchOldFeed() {
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Unexpected response from ${url}: ${res.status} ${await res.text()}`);
    }

    if (!res.body) {
      return new Map();
    }

    const body = /** @type {import("node:stream/web").ReadableStream<Uint8Array>} */ (res.body);

    return parseFeedToUrls(Readable.fromWeb(body));
  }

  return retry(fetchOldFeed, 5);
}

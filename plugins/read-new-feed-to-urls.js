import { createReadStream } from 'node:fs';
import parseFeedToUrls from './parse-feed-to-urls.js';

/** @param {string} path */
export default function readNewSitemap(path) {
  const stream = createReadStream(path, { encoding: 'utf8' });

  return parseFeedToUrls(stream);
}

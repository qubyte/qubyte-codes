import fs from 'node:fs';
import parseFeedToUrls from './parse-feed-to-urls.js';

export default function readNewSitemap(path) {
  const stream = fs.createReadStream(path, { encoding: 'utf8' });

  return parseFeedToUrls(stream);
}

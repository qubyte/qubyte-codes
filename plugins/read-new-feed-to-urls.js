import fs from 'fs';
import parseFeedToUrls from './parse-feed-to-urls';

export default function readNewSitemap(path) {
  const stream = fs.createReadStream(path, { encoding: 'utf8' });

  return parseFeedToUrls(stream);
}

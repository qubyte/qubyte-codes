import { readFile } from 'node:fs/promises';
import postToMastodon from '../lib/post-to-mastodon.js';

const path = process.argv[2];

if (!path) {
  console.log('No path given.'); // eslint-disable-line no-console
  process.exit(0);
}

console.log('Processing:', path); // eslint-disable-line no-console

const link = await readFile(path, 'utf8');
const { properties: { content: [content], name: [name], 'bookmark-of': [url] } } = JSON.parse(link);
const statusBody = new URLSearchParams({ status: `${content}\n\n${name}: ${url}`.trim() });

await postToMastodon('/api/v1/statuses', statusBody);

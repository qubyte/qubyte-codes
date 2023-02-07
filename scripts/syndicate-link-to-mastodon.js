import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import postToMastodon from '../lib/post-to-mastodon.js';

const { positionals: paths } = parseArgs({ allowPositionals: true });

if (!paths.length) {
  console.log('No path given.'); // eslint-disable-line no-console
}

for (const path of paths) {
  console.log('Processing:', paths); // eslint-disable-line no-console

  const link = await readFile(path, 'utf8');
  const { properties: { content: [content], name: [name], 'bookmark-of': [url] } } = JSON.parse(link);
  const statusBody = new URLSearchParams({ status: `${content}\n\n${name}: ${url}`.trim() });

  await postToMastodon('/api/v1/statuses', statusBody);
}

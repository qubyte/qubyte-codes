/* global Blob */

import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import postToMastodon from '../lib/post-to-mastodon.js';

const { positionals: paths } = parseArgs({ allowPositionals: true });

if (!paths.length) {
  console.log('No path given.');
}

for (const path of paths) {
  console.log('Processing:', path);

  const {
    properties: {
      content: [content] = [],
      name: [name] = [],
      photo = [],
      'bookmark-of': [url] = []
    }
  } = JSON.parse(await readFile(path, 'utf8'));
  const status = (url && name) ? `${content}\n\n${name}: ${url}`.trim() : content;
  const statusBody = new URLSearchParams({ status });

  for (const { value, alt } of photo) {
    const form = new FormData();
    const filePath = `content/${value}`.replace('.jpeg', '-original.jpeg');
    const content = await readFile(filePath);

    form.set('file', new Blob([content], { type: 'image/jpeg' }), 'image.jpeg');
    form.set('description', alt);

    const { id } = await postToMastodon('/api/v2/media', form);

    statusBody.append('media_ids[]', id);
  }

  await postToMastodon('/api/v1/statuses', statusBody);
}

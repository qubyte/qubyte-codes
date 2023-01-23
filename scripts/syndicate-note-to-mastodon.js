/* global FormData, Blob */

import { readFile } from 'node:fs/promises';
import postToMastodon from '../lib/post-to-mastodon.js';

const path = process.argv[2];

if (!path) {
  console.log('No path given.'); // eslint-disable-line no-console
  process.exit(0);
}

console.log('Processing:', path); // eslint-disable-line no-console

const { properties: { content: [status], photo } } = JSON.parse(await readFile(path, 'utf8'));
const statusBody = new URLSearchParams({ status });

if (photo && photo.length) {
  const form = new FormData();
  const filePath = `content/${photo[0].value}`.replace('.jpeg', '-original.jpeg');
  const content = await readFile(filePath);

  form.set('file', new Blob([content], { type: 'image/jpeg' }), 'image.jpeg');
  form.set('description', photo[0].alt);

  const { id } = await postToMastodon('/api/v2/media', form);

  statusBody.set('media_ids[]', id);
}

await postToMastodon('/api/v1/statuses', statusBody);

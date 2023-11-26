import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import postToMastodon from '../lib/post-to-mastodon.js';

const { positionals: paths, values: { 'base-url': baseUrl, 'access-token': token } } = parseArgs({
  options: {
    'base-url': { type: 'string' },
    'access-token': { type: 'string' }
  },
  allowPositionals: true
});

if (!baseUrl || !token) {
  throw new Error('Both a --base-url and an --access-token must be provided.');
}

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
      spoiler: [spoiler] = [],
      'bookmark-of': [url] = []
    }
  } = JSON.parse(await readFile(path, 'utf8'));
  const status = (url && name) ? `${content}\n\n${name}: ${url}`.trim() : content;
  const statusBody = new URLSearchParams({ status });

  if (spoiler) {
    statusBody.append('spoiler_text', spoiler);
  }

  for (const { value, alt } of photo) {
    const form = new FormData();
    const filePath = `content/${value}`.replace('.jpeg', '-original.jpeg');
    const content = await readFile(filePath);

    form.set('file', new Blob([content], { type: 'image/jpeg' }), 'image.jpeg');
    form.set('description', alt);

    const { id } = await postToMastodon({
      endpoint: '/api/v2/media',
      mastodonBaseUrl: baseUrl,
      mastodonAccessToken: token,
      body: form
    });

    statusBody.append('media_ids[]', id);
  }

  await postToMastodon({
    endpoint: '/api/v1/statuses',
    mastodonBaseUrl: baseUrl,
    mastodonAccessToken: token,
    body: statusBody
  });
}

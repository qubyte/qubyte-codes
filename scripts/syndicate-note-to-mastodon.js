import { readFile } from 'node:fs/promises';
import fetch, { FormData, fileFrom } from 'node-fetch';

const path = process.argv[2];

async function post(endpoint, body) {
  const res = await fetch(new URL(endpoint, process.env.MASTODON_BASE_URL), {
    headers: { authorization: `Bearer ${process.env.MASTODON_ACCESS_TOKEN}` },
    method: 'POST',
    body
  });

  if (!res.ok) {
    throw new Error(`Unexpected status from mastodon: ${res.status}`);
  }

  return res.json();
}

if (path) {
  console.log('Processing:', path); // eslint-disable-line no-console

  const { properties: { content, photo } } = JSON.parse(await readFile(path, 'utf8'));

  let photoId = null;

  if (photo && photo.length) {
    const form = new FormData();
    const file = await fileFrom(`content/${photo[0].value}`.replace('.jpeg', '-original.jpeg'), 'image/jpeg');
    form.set('file', file);
    form.set('description', photo[0].alt);

    ({ id: photoId } = await post('/api/v2/media', form));
  }

  await post('/api/v1/statuses', new URLSearchParams({
    status: content[0],
    ...(photoId ? { 'media_ids[]': photoId } : {})
  }));
} else {
  console.log('No path given.'); // eslint-disable-line no-console
}

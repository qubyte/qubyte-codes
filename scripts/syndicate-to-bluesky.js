import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import blueskyAuth from '../lib/bluesky-auth.js';
import postToBluesky from '../lib/post-to-bluesky.js';

const { positionals: paths, values: { 'app-password': password } } = parseArgs({
  options: { 'app-password': { type: 'string' } },
  allowPositionals: true
});

if (!password) {
  throw new Error('An --app-password must be provided.');
}

if (!paths.length) {
  console.log('No path given.');
}

const { accessJwt, did } = await blueskyAuth('qubyte.codes', password);

for (const path of paths) {
  console.log('Processing:', path);

  const data = await readFile(path, 'utf8');
  const { content, name, photo = [], 'bookmark-of': url } = JSON.parse(data);

  const post = {
    $type: 'app.bsky.feed.post',
    createdAt: new Date().toISOString()
  };

  if (url && name) {
    post.text = `${content}\n\n${name}: ${url}`;

    const length = Buffer.byteLength(post.text);

    post.facets ||= [];
    post.facets.push({
      index: {
        byteStart: length - Buffer.byteLength(url),
        byteEnd: length
      },
      features: [
        {
          $type: 'app.bsky.richtext.facet#link',
          uri: url
        }
      ]
    });
  } else {
    post.text = content;
  }

  for (const { value, url, alt } of [].concat(photo)) {
    const { blob } = await postToBluesky({
      endpoint: '/xrpc/com.atproto.repo.uploadBlob',
      body: await readFile(`content${value || url}`),
      blueskyAccessToken: accessJwt,
      headers: { 'content-type': 'image/jpeg' }
    });

    post.embed ||= { $type: 'app.bsky.embed.images', images: [] };
    post.embed.images.push({ alt, image: blob });
  }

  await postToBluesky({
    endpoint: '/xrpc/com.atproto.repo.createRecord',
    body: Buffer.from(JSON.stringify({
      repo: did,
      collection: 'app.bsky.feed.post',
      record: post
    })),
    blueskyAccessToken: accessJwt,
    headers: { 'content-type': 'application/json' }
  });
}

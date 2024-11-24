import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import blueskyAuth from '../lib/bluesky-auth.js';
import postToBluesky from '../lib/post-to-bluesky.js';

const { positionals: paths, values: { handle, 'app-password': password } } = parseArgs({
  options: {
    handle: { type: 'string', short: 'h' },
    'app-password': { type: 'string', short: 'p' }
  },
  allowPositionals: true
});

if (!handle) {
  throw new Error('A --handle must be provided');
}

if (!password) {
  throw new Error('An --app-password must be provided.');
}

if (!paths.length) {
  throw new Error('At least one path must be provided.');
}

// Bluesky auth returns an access token and a did (an ID). It also sends a
// refresh token which can be used to acquire a new access token once the access
// token expires, but it's not necessary for the duration of a simple script
// like this. The password here is an *app password*
// See: https://bsky.app/settings/app-passwords
const { accessJwt, did } = await blueskyAuth(handle, password);

// This script can take multiple paths, but typically only one is given.
for (const path of paths) {
  console.log('Processing:', path);

  // Files are encoded in jf2 format: https://jf2.spec.indieweb.org
  const data = await readFile(path, 'utf8');
  const { content, name, photo = [], 'bookmark-of': url } = JSON.parse(data);

  // The post object will contain the record we sent to Bluesky.
  const post = {
    $type: 'app.bsky.feed.post',
    createdAt: new Date().toISOString()
  };

  // When a bookmark-of and a name are in the jf2 file it is a bookmark.
  if (url && name) {
    // The name contains the author and title of the bookmark, and the content
    // is my note about it.
    post.text = `${content}\n\n${name}`;

    const length = Buffer.byteLength(post.text);

    // To make the name part a link, we need a facet with its UTF-8 offsets.
    // Buffer.byteLength gives us these even through JS does not internally use
    // UTF-8.
    post.facets ||= [];
    post.facets.push({
      index: {
        byteStart: length - Buffer.byteLength(name),
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

  // One or more photos might be part of a note.
  for (const { value, url, alt } of [].concat(photo)) {
    // Image paths are from the content directory.
    const fileUrl = new URL(`../content${value || url}`, import.meta.url);

    // First the image must be uploaded to Bluesky. It returns a blob object I
    // can use like a reference.
    const { blob } = await postToBluesky({
      endpoint: '/xrpc/com.atproto.repo.uploadBlob',
      body: await readFile(fileUrl),
      blueskyAccessToken: accessJwt,
      headers: { 'content-type': 'image/jpeg' }
    });

    // A reference to the image is added to the post as an embed. This is where
    // alt text is also applied.
    post.embed ||= { $type: 'app.bsky.embed.images', images: [] };
    post.embed.images.push({ alt, image: blob });
  }

  // With the post assembled, it can be sent to Bluesky to create the post.
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

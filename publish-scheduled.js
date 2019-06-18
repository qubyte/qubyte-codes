'use strict';

/* eslint-disable no-console */

const { readFile, readdir } = require('fs').promises;
const { join } = require('path');
const frontMatter = require('front-matter');
const fetch = require('node-fetch');
const { createHash } = require('crypto');
const { GITHUB_REPOSITORY, GITHUB_TOKEN } = process.env;

function headers() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${GITHUB_TOKEN}`
  };
}

// TODO: It's possible to do this in a single commit using the git trees API.
async function publishFile(filename, content) {
  const blobHash = createHash('sha1')
    .update('blob ')
    .update(content.length.toString())
    .update('\0')
    .update(content)
    .digest()
    .toString('hex');

  const deleteRes = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/contents/content/scheduled/${filename}`, {
    headers: headers(),
    method: 'DELETE',
    body: JSON.stringify({
      message: `Deletes ${filename} from scheduled directory.\n\n[skip ci]`,
      sha: blobHash
    })
  });

  if (!deleteRes.ok) {
    throw new Error(`Unexpected response when deleting scheduled/${filename} (${deleteRes.status}): ${await deleteRes.text()}`);
  }

  const createRes = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/contents/content/posts/${filename}`, {
    headers: headers(),
    method: 'PUT',
    body: JSON.stringify({
      message: `Publishes ${filename}.`,
      content: content.toString('base64')
    })
  });

  if (!createRes.ok) {
    throw new Error(`Unexpected response when creating posts/${filename} (${createRes.status}): ${await createRes.text()}`);
  }
}

async function checkAndPublishScheduled() {
  const filenames = await readdir(join(__dirname, 'content', 'scheduled'));

  let failures = false;

  for (const filename of filenames) {
    if (filename.startsWith('.') || !filename.endsWith('.md')) {
      continue;
    }

    const path = join(__dirname, 'content', 'scheduled', filename);
    const post = await readFile(path);
    const publishDate = new Date(frontMatter(post.toString('utf8')).attributes.datetime);

    if (publishDate.getTime() < Date.now()) {
      try {
        console.log(`Publishing ${filename}`);
        await publishFile(filename, post);
        console.log(`Published ${filename}`);
      } catch (e) {
        console.error(e.stack);
        failures = true;
      }
    }
  }

  if (failures) {
    process.exit(1);
  }
}

checkAndPublishScheduled();

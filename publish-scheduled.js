'use strict';

/* eslint-disable no-console */

const { readFile, readdir } = require('fs').promises;
const { join } = require('path');
const frontMatter = require('front-matter');
const fetch = require('node-fetch');
const { GITHUB_REPOSITORY: ownerRepo, GITHUB_TOKEN: token } = process.env;

// TODO: It's possible to do this in a single commit using the git trees API.
async function publishFile(filename, content) {
  const createRes = await fetch(`https://api.github.com/repos/${ownerRepo}/contents/posts/${filename}?access_token=${token}`, {
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
    body: JSON.stringify({ message: `Publishes ${filename}`, content: content.toString('base64') })
  });

  if (!createRes.ok) {
    throw new Error(`Unexpected response when creating posts/${filename} (${createRes.status}): ${await createRes.text()}`);
  }

  const deleteRes = await fetch(`https://api.github.com/repos.${ownerRepo}/contents/scheduled/${filename}?access_token=${token}`, {
    headers: { 'Content-Type': 'application/json' },
    method: 'DELETE',
    body: JSON.stringify({ message: `Deletes ${filename} from scheduled directory.` })
  });

  if (!deleteRes.ok) {
    throw new Error(`Unexpected response when deleting scheduled/${filename} (${deleteRes.status}): ${await deleteRes.text()}`);
  }
}

async function checkAndPublishScheduled() {
  const filenames = await readdir(join(__dirname, 'scheduled'));

  let failures = false;

  for (const filename of filenames) {
    if (filename.startsWith('.') || !filename.endsWith('.md')) {
      continue;
    }

    const path = join(__dirname, 'scheduled', filename);
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

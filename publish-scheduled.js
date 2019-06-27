'use strict';

/* eslint-disable no-console */

const { readFile, readdir } = require('fs').promises;
const { join } = require('path');
const frontMatter = require('front-matter');
const fetch = require('node-fetch');

const baseUrl = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}`;
const Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function getJson(path) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, { headers: { Authorization } });

  if (res.status !== 200) {
    throw new Error(`Unexpected status from GitHub ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

async function sendJson(path, data) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (res.status !== 201) {
    throw new Error(`Unexpected status from GitHub ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

async function updateJson(path, data) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (res.status !== 200) {
    throw new Error(`Unexpected status from GitHub ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

async function publishPosts(filenames) {
  const scheduledPaths = filenames.map(fn => `scheduled/${fn}`);
  const branch = await getJson('/branches/master');
  const rootTree = await getJson(`/git/trees/${branch.commit.sha}`);
  const contentLeaf = rootTree.tree.find(leaf => leaf.path === 'content' && leaf.type === 'tree');
  const contentTree = await getJson(`/git/trees/${contentLeaf.sha}?recursive=true`);

  if (contentTree.truncated) {
    throw new Error('Content tree truncated.');
  }

  const newTree = await sendJson('/git/trees?recursive=true', {
    base_tree: contentTree.sha,
    tree: contentTree.tree.map(leaf => {
      const copied = { ...leaf };

      if (scheduledPaths.includes(copied.path)) {
        copied.path = copied.path.replace('scheduled', 'posts');
      }

      return copied;
    })
  });
  const commit = await sendJson('/git/commits', {
    message: 'Publishes posts.',
    tree: newTree.sha,
    parents: ['branch.commit.sha']
  });
  await updateJson('git/refs/heads/master', {
    sha: commit.sha
  });
}

async function checkAndPublishScheduled() {
  const filenames = await readdir(join(__dirname, 'content', 'scheduled'));
  const toPublish = [];

  for (const filename of filenames) {
    if (filename.startsWith('.') || !filename.endsWith('.md')) {
      continue;
    }

    const path = join(__dirname, 'content', 'scheduled', filename);
    const post = await readFile(path);
    const publishDate = new Date(frontMatter(post.toString('utf8')).attributes.datetime);

    if (publishDate.getTime() < Date.now()) {
      toPublish.push(filename);
    }
  }

  await publishPosts(toPublish);

  console.log('Published:', toPublish.join(', '));
}

checkAndPublishScheduled()
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

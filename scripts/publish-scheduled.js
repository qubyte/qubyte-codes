/* eslint-disable no-console */

import fetch from 'node-fetch';
import loadPostFiles from '../lib/load-post-files.js';
import { fileURLToPath } from 'url';

const BASE_URL = 'https://qubyte.codes';
const POST_FILES_PATH = fileURLToPath(new URL('../content/posts', import.meta.url));

async function getPublishedBlogSlugs() {
  const res = await fetch(`${BASE_URL}/sitemap.txt`);
  const body = await res.text();

  if (!res.ok) {
    throw new Error(`Unexpected status from qubyte.codes ${res.status}: ${body}`);
  }

  const blogEntryBaseUrl = `${BASE_URL}/blog/`;

  const slugs = body
    .split('\n')
    .filter(url => url.startsWith(blogEntryBaseUrl))
    .map(url => url.slice(blogEntryBaseUrl.length));

  return slugs;
}

async function checkNeedsPublish() {
  const publishedNowSlugs = await getPublishedBlogSlugs();
  const shouldBePublished = await loadPostFiles(POST_FILES_PATH, BASE_URL);

  const shouldBePublishedSlugs = shouldBePublished.map(meta => meta.slug);

  console.log('current:', publishedNowSlugs.length, publishedNowSlugs.sort());
  console.log('next:', shouldBePublishedSlugs.length, shouldBePublishedSlugs.sort());

  return shouldBePublishedSlugs.filter(slug => !publishedNowSlugs.includes(slug));
}

async function run() {
  const shouldPublish = await checkNeedsPublish();

  if (!shouldPublish.length) {
    return console.log('Nothing to publish right now.');
  }

  const res = await fetch(process.env.BUILD_HOOK_URL, { method: 'POST' });

  if (!res.ok) {
    throw new Error(`Unexpected status from Netlify ${res.status}: ${await res.text()}`);
  }

  console.log('Sent build hook request to Netlify to publish', shouldPublish.join(', '));
}

run()
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

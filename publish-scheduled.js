'use strict';

/* eslint-disable no-console */

const { readFile, readdir } = require('fs').promises;
const { join } = require('path');
const frontMatter = require('front-matter');
const createSlug = require('./lib/create-slug');
const fetch = require('node-fetch');

async function getPublishedBlogSlugs() {
  const res = await fetch('https://qubyte.codes/sitemap.txt');
  const body = await res.text();

  if (!res.ok) {
    throw new Error(`Unexpected status from qubyte.codes ${res.status}: ${body}`);
  }

  const blogEntryBaseUrl = 'https://qubyte.codes/blog/';

  const slugs = body
    .split('\n')
    .filter(url => url.startsWith('https://qubyte.codes/blog/'))
    .map(url => url.slice(blogEntryBaseUrl.length));

  return slugs;
}

async function checkNeedsPublish() {
  const publishedNowSlugs = await getPublishedBlogSlugs();
  const filenames = await readdir(join(__dirname, 'content', 'posts'));
  const markdownFilenames = filenames.filter(fn => !fn.startsWith('.') && fn.endsWith('.md'));
  const metadata = await Promise.all(markdownFilenames.map(async fn => {
    const content = await readFile(fn, 'utf8');
    const meta = frontMatter(content);

    return {
      timestamp: new Date(meta.attributes.datetime).getTime(),
      slug: createSlug(meta.attributes.title)
    };
  }));
  const shouldBePublished = metadata.filter(meta => meta.datetime < Date.now());
  const shouldBePublishedSlugs = shouldBePublished.map(meta => meta.slug);

  // Check for newly valid posts.
  return shouldBePublishedSlugs.every(slug => publishedNowSlugs.includes(slug));
}

async function run() {
  const shouldPublish = await checkNeedsPublish();

  if (!shouldPublish) {
    return console.log('Nothing to publish right now.');
  }

  const res = await fetch(process.env.NETLIFY_BUILD_HOOK_URL, { method: 'POST' });

  if (!res.ok) {
    throw new Error(`Unexpected status from Netlify ${res.statys}: ${await res.text()}`);
  }

  console.log('Sent build hook request to Netlify.');
}

run()
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

/* eslint-disable no-console */

import { promises as fs } from 'fs';
import fetch from 'node-fetch';
import { parseFrontMatter } from '../lib/load-post-files.js';

const LAST_BUILD_URL = 'https://qubyte.codes/last-build.txt';
const POST_FILES_DIR = new URL('../content/posts/', import.meta.url);
const BUILD_HOOK_URL = process.env.BUILD_HOOK_URL;

async function getLastBuildTime() {
  const res = await fetch(LAST_BUILD_URL);
  const body = await res.text();

  if (!res.ok) {
    throw new Error(`Unexpected response from ${LAST_BUILD_URL} ${body}`);
  }

  return Date.parse(body.trim());
}

async function isPublished(filename) {
  if (filename[0] === '.' || !filename.endsWith('.md')) {
    return { filename, published: false };
  }

  const content = await fs.readFile(new URL(filename, POST_FILES_DIR), 'utf8');
  const { attributes: { datetime, draft } } = parseFrontMatter(content);

  return { filename, published: !draft && Date.parse(datetime) };
}

async function triggerBuild() {
  const res = await fetch(BUILD_HOOK_URL, { method: 'POST' });

  if (!res.ok) {
    throw new Error(`Unexpected status from vercel: ${res.status} ${await res.text()}`);
  }
}

async function checkShouldTriggerBuild() {
  const lastBuildTime = await getLastBuildTime();

  console.log('Last build time:', lastBuildTime);

  const fileNames = await fs.readdir(POST_FILES_DIR);
  const published = await Promise.all(fileNames.map(isPublished));

  console.log('Files should be published:', published);

  const now = Date.now();
  const shouldTrigger = published.filter(p => p && p > lastBuildTime && p < now);

  if (!shouldTrigger.length) {
    console.log('No new files to publish.');
    return;
  }

  console.log('New files to publish:', shouldTrigger);

  await triggerBuild();

  console.log('Build triggered.');
}

checkShouldTriggerBuild()
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

import { join as pathJoin } from 'node:path';
import { readFile } from 'node:fs/promises';

function buildShortlinksPath(publishDir) {
  return pathJoin('.', publishDir, 'shortlinks.txt');
}

function buildShortlinksUrl(baseUrl) {
  return `${baseUrl}/shortlinks.txt`;
}

async function fetchShortlinks({ constants, utils }) {
  const shortlinksPath = buildShortlinksPath(constants.PUBLISH_DIR);
  const restored = await utils.cache.restore(shortlinksPath);

  if (restored) {
    const content = await readFile(shortlinksPath, 'utf8');
    console.log('Shortlinks retrieved from cache');
    return content;
  }

  console.error('Unable to shortlinks file from cache, falling back to network.');

  // If we can't find the shortlinks file in the cache then get it from the
  // site itself.
  const res = await fetch(buildShortlinksUrl(process.env.URL));

  if (!res.ok) {
    throw new Error(`Unexpected status: ${res.status}`);
  }

  return res.text();
}

// This is probably unnecessary since each method in this module will only be
// invoked once (and even then only in sequence).
const oldShortLinksForBuild = new Map();

export async function onPreBuild({ constants, utils }) {
  try {
    const oldShortlinks = (await fetchShortlinks({ constants, utils })).trim();
    oldShortLinksForBuild.set(process.env.BUILD_ID, oldShortlinks);
    console.log('Size of old shortlinks:', Buffer.byteLength(oldShortlinks));
  } catch (error) {
    utils.build.failPlugin('Error making feed request.', { error });
  }
}


export async function onSuccess({ constants, utils }) {
  const oldShortlinks = oldShortLinksForBuild.get(process.env.BUILD_ID);
  const shortlinksPath = buildShortlinksPath(constants.PUBLISH_DIR);
  const newShortlinks = (await readFile(shortlinksPath, 'utf8')).trim();

  console.log('Size of new shortlinks:', Buffer.byteLength(newShortlinks));

  await utils.cache.save(shortlinksPath);

  if (oldShortlinks === newShortlinks) {
    return console.log('No change to shortlinks.');
  }

  const res = await fetch(process.env.BUILD_SHORTLINKS_TRIGGER, { method: 'POST' });

  if (!res.ok) {
    utils.build.failPlugin('Error triggering shortlinks build.', { status: res.status });
  }
}

export function onEnd() {
  oldShortLinksForBuild.delete(process.env.BUILD_ID);
}

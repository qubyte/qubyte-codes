import { join as pathJoin } from 'node:path';
import { readFile } from 'node:fs/promises';
import fetch from 'node-fetch';

async function fetchShortlinks() {
  const res = await fetch(`${process.env.URL}/shortlinks.txt`);

  if (!res.ok) {
    throw new Error(`Unexpected status: ${res.status}`);
  }

  return res.text();
}

// This is probably unnecessary since each method in this module will only be
// invoked once (and even then only in sequence).
const oldShortLinksForBuild = new Map();

export async function onPreBuild({ utils }) {
  try {
    const oldShortlinks = (await fetchShortlinks()).trim();
    oldShortLinksForBuild.set(process.env.BUILD_ID, oldShortlinks);
    console.log('Size of old shortlinks:', Buffer.byteLength(oldShortlinks));
  } catch (error) {
    utils.build.failPlugin('Error making feed request.', { error });
  }
}


export async function onSuccess({ constants, utils }) {
  const oldShortlinks = oldShortLinksForBuild.get(process.env.BUILD_ID);
  const newShortlinks = (await readFile(pathJoin('.', constants.PUBLISH_DIR, 'shortlinks.txt'), 'utf8')).trim();

  console.log('Size of new shortlinks:', Buffer.byteLength(newShortlinks));

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

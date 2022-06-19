import { join as pathJoin } from 'node:path';

import fetchOldFeedToUrls from '../fetch-old-feed-to-urls.js';
import readNewFeedToUrls from '../read-new-feed-to-urls.js';
import getMentionsForPage from './get-mentions-for-page.js';

// This is probably unnecessary since each method in this module will only be
// invoked once (and even then only in sequence).
/** @type Map<string, Map<string, import('./mention').Mention[]>> */
const mentionsForDispatch = new Map();
const pageRegex = new RegExp(`^${process.env.URL}/(blog|links|likes|replies|notes)/.+`);
const ignoredHostnames = [
  'localhost',
  'qubyte.codes',
  'webmention.io',
  'twitter.com',
  'github.com',
  'www.w3.org',
  'paypal.me'
];

// Gather URLs, targets, and endpoints *after* the build has run but *before*
// pages are made live. At this time we have access (via the network) to old
// pages which will be deleted, and new or updated pages (via the file system)
// which will be published after this build stage. Similarly, we have access to
// The old and new version of an updated page, so we can send mentions for all
// added, removed, and unchanged targets (as required by the spec).
export async function onPostBuild({ constants }) {
  /** @type string[] */
  const publicDir = pathJoin('.', constants.PUBLISH_DIR);
  /** @type Map<string, import('./mention.js').Mention[]*/
  const mentions = new Map();

  const [oldEntries, newEntries] = await Promise.all([
    fetchOldFeedToUrls(`${process.env.URL}/atom.xml`),
    readNewFeedToUrls(pathJoin(publicDir, 'atom.xml'))
  ]);

  // When a page is deleted, mentions for it should be re-dispatched to alert
  // the receiver that links they may have to the resource are gone.
  // https://www.w3.org/TR/webmention/#sending-webmentions-for-deleted-posts
  for (const [url] of oldEntries) {
    if (pageRegex.test(url) && !newEntries.has(url)) {
      console.log('DELETED URL:', url);
      mentions.set(url, await getMentionsForPage(url, publicDir, { old: true, new: false, ignoredHostnames }));
    }
  }

  for (const [url, latestUpdate] of newEntries) {
    if (!pageRegex.test(url)) {
      continue;
    }

    const previousUpdate = oldEntries.get(url);

    if (!previousUpdate) {
      console.log('ADDED URL:', url);
      mentions.set(url, await getMentionsForPage(url, publicDir, { old: false, new: true, ignoredHostnames }));
    } else if (previousUpdate < latestUpdate) {
      // Updated pages should be checked for outbound mentions.
      // https://www.w3.org/TR/webmention/#h-sending-webmentions-for-updated-posts
      console.log('UPDATED URL:', url);
      mentions.set(url, await getMentionsForPage(url, publicDir, { old: true, new: true, ignoredHostnames }));
    }
  }

  mentionsForDispatch.set(process.env.BUILD_ID, mentions);
}

// Mentions are dispatched *after* successful deployment because they may
// trigger automated checks by recipients.
export async function onSuccess({ constants }) {
  const allMentions = mentionsForDispatch.get(process.env.BUILD_ID) || [];

  // URLs are checked and mentions dispatched in sequence deliberately to make
  // logs more comprehensible. It will be uncommon for more than one URL to be
  // new at a time anyway.
  for (const [url, mentions] of allMentions) {
    console.log('Dispatching mentions for:', url);

    for (const [index, mention] of mentions.entries()) {
      console.log(`Dispatching webmention no. ${index}:`, mention);

      try {
        if (constants.IS_LOCAL) {
          console.log(`Running locally. Pretend dispatch of no. ${index}`);
        } else {
          await mention.dispatch();
          console.log(`Done dispatching webmention no. ${index}`);
        }
      } catch (error) {
        console.error(`Error dispatching webmention no. ${index}: ${error.stack || error.message}`);
      }
    }
  }
}

export function onEnd() {
  mentionsForDispatch.delete(process.env.BUILD_ID);
}

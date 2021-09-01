import path from 'node:path';

import fetchOldFeedToUrls from '../fetch-old-feed-to-urls.js';
import readNewFeedToUrls from '../read-new-feed-to-urls.js';
import dispatchWebmentionsForUrl from './dispatch-webmentions-for-url.js';

// This is probably unnecessary since each method in this module will only be
// invoked once (and even then only in sequence).
const oldUrlsForBuild = new Map();
const pageRegex = new RegExp('^https://qubyte.codes/(blog|links|likes|replies|notes)/.+');

const nonProd = {
  onPreBuild({ utils }) {
    console.log('Skipping for non-production build.');
    utils.status.show({ summary: 'Skipped for non-production build.' });
  }
};

const prod = {
  async onPreBuild({ utils }) {
    const feedUrl = `${process.env.URL}/atom.xml`;

    try {
      const oldUrls = await fetchOldFeedToUrls(feedUrl);
      oldUrlsForBuild.set(process.env.BUILD_ID, oldUrls);
      console.log('Number of old URLs:', oldUrls.size);
    } catch (error) {
      utils.build.failPlugin('Error making feed request.', { error, feedUrl });
    }
  },

  async onSuccess({ constants }) {
    const oldUrls = oldUrlsForBuild.get(process.env.BUILD_ID);
    const newUrls = await readNewFeedToUrls(path.join('.', constants.PUBLISH_DIR, 'atom.xml'));

    console.log('Number of new URLs:', newUrls.size);

    // URLs are checked and mentions dispatched in sequence deliberately to make
    // logs more comprehensible. It will be uncommon for more than one URL to be
    // new at a time anyway.
    for (const url of newUrls) {
      if (pageRegex.test(url) && !oldUrls.has(url)) {
        console.log('Dispatching webmentions for:', url);

        try {
          await dispatchWebmentionsForUrl(url);
          console.log('Done dispatching webmentions for:', url);
        } catch (error) {
          console.error(`Error dispatching webmentions for ${url}: ${error.stack || error.message}`);
        }
      }
    }
  },

  onEnd() {
    oldUrlsForBuild.delete(process.env.BUILD_ID);
  }
};

export default () => process.env.CONTEXT === 'production' ? prod : nonProd;

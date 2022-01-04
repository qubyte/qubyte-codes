'use strict';

const path = require('path');
const fetchOldFeedToUrls = require('../fetch-old-feed-to-urls');
const readNewFeedToUrls = require('../read-new-feed-to-urls');
const tweetPost = require('./tweet-post');

// This is probably unnecessary since each method in this module will only be
// invoked once (and even then only in sequence).
const oldUrlsForBuild = new Map();
const pageRegex = new RegExp('^https://qubyte.codes/blog/.+');

module.exports = {
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
        console.log('Dispatching tweet for:', url);

        try {
          await tweetPost(url);
          console.log('Done dispatching tweet for:', url);
        } catch (error) {
          console.error(`Error dispatching tweet for ${url}: ${error.stack || error.message}`);
        }
      }
    }
  },

  onEnd() {
    oldUrlsForBuild.delete(process.env.BUILD_ID);
  }
};

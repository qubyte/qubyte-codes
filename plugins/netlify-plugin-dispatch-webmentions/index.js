'use strict';

const path = require('path');

const fetchOldFeedToUrls = require('./fetch-old-feed-to-urls');
const readNewSitemapToUrls = require('./read-new-feed-to-urls');
const dispatchWebmentionsForUrl = require('./dispatch-webmentions-for-url');

// This is probably unnecessary since each method in this module will only be
// invoked once (and even then only in sequence).
const oldUrlsForBuild = new Map();
const pageRegex = new RegExp('^https://qubyte.codes/(blog|links|likes|replies|notes)/.+');

exports.onPreBuild = async function onPreBuild({ utils }) {
  if (process.env.CONTEXT !== 'production') {
    console.log('Skipping for non-production build.');
    utils.status.show({ summary: 'Skipped for non-production build.' });
    return;
  }

  const feedUrl = `${process.env.URL}/atom.xml`;

  console.log('Fetching feed from:', feedUrl);

  try {
    oldUrlsForBuild.set(process.env.BUILD_ID, await fetchOldFeedToUrls(feedUrl));
  } catch (error) {
    return utils.build.failPlugin('Error making sitemap request.', { error, feedUrl });
  }

  console.log('Old urls:', oldUrlsForBuild.get(process.env.BUILD_ID));
};

exports.onSuccess = async function onSuccess({ constants }) {
  if (process.env.CONTEXT !== 'production') {
    console.log('Skipping for non-production build.');
    return;
  }

  const oldUrls = oldUrlsForBuild.get(process.env.BUILD_ID);
  const newUrls = await readNewSitemapToUrls(path.join(constants.PUBLISH_DIR, 'sitemap.txt'));

  // URLs are checked and mentions dispatched in sequence deliberately to make
  // logs more comprehensible. It will be uncommon for more than one URL to be
  // new at a time anyway.
  for (const url of newUrls) {
    if (pageRegex.test(url) && !oldUrls.has(url)) {
      console.log('Dispatching webmentions for:', url);

      try {
        await dispatchWebmentionsForUrl(url);
      } catch (error) {
        console.error(`Error dispatching webmentions for ${url}: ${error.stack || error.message}`);
      }

      console.log('Done dispatching webmentions for:', url);
    }
  }
};

exports.onEnd = function onEnd() {
  oldUrlsForBuild.delete(process.env.BUILD_ID);
};

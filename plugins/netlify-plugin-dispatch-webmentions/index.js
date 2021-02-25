'use strict';

const { readFile } = require('fs').promises;
const path = require('path');

const fetchOldSitemap = require('./fetch-old-sitemap');
const compareSitemapsAndDispatchWebmentions = require('./compare-sitemaps-and-dispatch-mentions');

let oldSitemap;

exports.onPreBuild = async function onPreBuild({ utils }) {
  if (process.env.CONTEXT !== 'production') {
    console.log('Skipping for non-production build.');
    utils.status.show({ summary: 'Skipped for non-production build.' });
    return;
  }

  try {
    oldSitemap = await fetchOldSitemap();
  } catch (error) {
    return utils.build.failPlugin('Error making sitemap request.', { error });
  }

  console.log('Old sitemap:', oldSitemap);
};

exports.onSuccess = async function onSuccess({ constants }) {
  if (process.env.CONTEXT !== 'production') {
    console.log('Skipping for non-production build.');
    return;
  }

  const newSitemap = await readFile(path.join(constants.PUBLISH_DIR, 'sitemap.txt'), 'utf8');

  await compareSitemapsAndDispatchWebmentions({ oldSitemap, newSitemap });
};

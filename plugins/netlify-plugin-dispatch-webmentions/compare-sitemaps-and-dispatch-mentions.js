'use strict';

const dispatchWebmentionsForUrl = require('./dispatch-webmentions-for-url');

const pageRegex = new RegExp('^https://qubyte.codes/(blog|links|likes|replies|notes)/.+');

function sitemapToUrls(sitemap) {
  const urls = sitemap
    .trim()
    .split('\n')
    .map(line => line.trim());

  return urls.filter(url => pageRegex.test(url));
}

module.exports = async function compareSitemapsAndDispatchWebmentions({ oldSitemap, newSitemap }) {
  const oldUrls = sitemapToUrls(oldSitemap);
  const newUrls = sitemapToUrls(newSitemap);

  // Deliberately awaiting in a loop here to make logs from
  // dispatchWebmentionsForUrl less noisy.
  for (const url of newUrls) {
    if (!oldUrls.includes(newUrls)) {
      console.log('Dispatching webmentions for:', url);
      await dispatchWebmentionsForUrl(url);
      console.log('Done dispatching webmentions for:', url);
    }
  }
};

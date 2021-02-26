'use strict';

const fs = require('fs');
const parseFeedToUrls = require('./parse-feed-to-urls');

module.exports = function readNewSitemap(path) {
  const stream = fs.createReadStream(path, { encoding: 'utf8' });

  return parseFeedToUrls(stream);
};

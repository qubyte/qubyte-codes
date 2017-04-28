'use strict';

module.exports = {
  staticFileGlobs: [
    'public/about.html',
    'public/index.html',
    'public/about.html',
    'public/blog/*.html',
    'public/icons/*.png',
    'public/*.css',
    'public/index.js',
    'public/manifest.json'
  ],
  root: 'public/',
  stripPrefix: 'public',
  dontCacheBustUrlsMatching: /./,
  swFile: 'sw.js'
};

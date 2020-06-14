'use strict';

// Plucks and wraps the first paragraph out of post HTML to form a snippet.
module.exports = function checkForRubyAnnotations(document) {
  const hasRuby = !!document.querySelector('ruby');

  return hasRuby;
};

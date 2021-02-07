'use strict';

module.exports = function checkForRubyAnnotations(document) {
  const hasRuby = !!document.querySelector('ruby');

  return hasRuby;
};

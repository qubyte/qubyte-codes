'use strict';

// Plucks and wraps the first paragraph out of document to form a snippet.
module.exports = function makeSnippet(document) {
  const innerHtml = document
    .querySelector('p')
    .innerHTML
    .slice(0, -1);

  return `<p class="p-summary">${innerHtml}…</p>`;
};

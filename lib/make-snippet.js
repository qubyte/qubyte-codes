'use strict';

const { JSDOM } = require('jsdom');

// Plucks and wraps the first paragraph out of post HTML to form a snippet.
module.exports = function makeSnippet(rendered) {
  const innerHtml = new JSDOM(rendered)
    .window
    .document
    .querySelector('p')
    .innerHTML
    .slice(0, -1);

  return `<p class="p-summary">${innerHtml}…</p>`;
};

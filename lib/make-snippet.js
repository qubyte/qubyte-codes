'use strict';

const cheerio = require('cheerio');

// Plucks and wraps the first paragraph out of post HTML to form a snippet.
module.exports = function makeSnippet(rendered) {
  const innerHtml = cheerio.load(rendered)('p')
    .html()
    .slice(0, -1);

  return `<p class="quote">${innerHtml}</p>`;
};

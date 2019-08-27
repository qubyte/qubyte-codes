'use strict';

const assert = require('assert').strict;
const cheerio = require('cheerio');
const makeSnippet = require('../../lib/make-snippet');

describe('make-snippet', () => {
  let $;

  beforeEach(() => {
    const snippet = makeSnippet(`
      <article>
        <p>I'm the first paragraph.</p>
        <p>I'm the second paragraph.</p>
        <p>I'm the third paragraph.</p>
      </article>
    `);

    $ = cheerio.load(snippet);
  });

  it('is a function', () => {
    assert.equal(typeof makeSnippet, 'function');
  });

  it('returns a single paragraph', () => {
    assert($('p').length, 1);
  });

  it('removes the final character within the paragraph and replaces it with an elipses', () => {
    assert($('p').text(), 'I\'m the first paragraph…');
  });
});

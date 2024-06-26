import { describe, beforeEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import makeSnippet from '../../lib/make-snippet.js';

describe('make-snippet', () => {
  let document;

  beforeEach(() => {
    const snippet = makeSnippet(new JSDOM(`
      <article>
        <p>僕は the first paragraph.</p>
        <p>I'm the second paragraph.</p>
        <p>I'm the third paragraph.</p>
      </article>
    `).window.document);

    ({ window: { document } } = new JSDOM(snippet));
  });

  it('is a function', () => {
    assert.equal(typeof makeSnippet, 'function');
  });

  it('returns a single paragraph', () => {
    assert.equal(document.querySelectorAll('p').length, 1);
  });

  it('gives the returned paragraph a "p-summary" class', () => {
    assert.equal(document.querySelector('p').className, 'p-summary');
  });

  it('removes the final character within the paragraph and replaces it with an elipses', () => {
    assert.equal(document.querySelector('p').innerHTML, '僕は the first paragraph…');
  });
});

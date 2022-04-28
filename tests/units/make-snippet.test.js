import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import makeSnippet from '../../lib/make-snippet.js';

test('make-snippet', () => {
  test('is a function', () => {
    assert.equal(typeof makeSnippet, 'function');
  });

  test('returns a single paragraph', () => {
    const snippet = makeSnippet(new JSDOM(`
      <article>
        <p>僕は the first paragraph.</p>
        <p>I'm the second paragraph.</p>
        <p>I'm the third paragraph.</p>
      </article>
    `).window.document);

    const { window: { document } } = new JSDOM(snippet);

    assert.equal(document.querySelectorAll('p').length, 1);
  });

  test('gives the returned paragraph a "p-summary" class', () => {
    const snippet = makeSnippet(new JSDOM(`
      <article>
        <p>僕は the first paragraph.</p>
        <p>I'm the second paragraph.</p>
        <p>I'm the third paragraph.</p>
      </article>
    `).window.document);

    const { window: { document } } = new JSDOM(snippet);

    assert.equal(document.querySelector('p').className, 'p-summary');
  });

  test('removes the final character within the paragraph and replaces it with an elipses', () => {
    const snippet = makeSnippet(new JSDOM(`
      <article>
        <p>僕は the first paragraph.</p>
        <p>I'm the second paragraph.</p>
        <p>I'm the third paragraph.</p>
      </article>
    `).window.document);

    const { window: { document } } = new JSDOM(snippet);

    assert.equal(document.querySelector('p').innerHTML, '僕は the first paragraph…');
  });
});

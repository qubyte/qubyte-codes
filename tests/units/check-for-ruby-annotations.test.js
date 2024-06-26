import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import checkForRubyAnnotations from '../../lib/check-for-ruby-annotations.js';

describe('check-for-ruby-annotations', () => {
  it('is a function', () => {
    assert.equal(typeof checkForRubyAnnotations, 'function');
  });

  it('returns false when there are no ruby annotations in the document', () => {
    const { document } = new JSDOM(`
        <article>
        <p><span lang="ja">僕は</span> the first paragraph.</p>
        <p>I'm the second paragraph.</p>
        <p>I'm the third paragraph.</p>
      </article>
    `).window;

    assert.equal(checkForRubyAnnotations(document), false);
  });

  it('returns true when there are ruby annotations in the document', () => {
    const { document } = new JSDOM(`
        <article>
        <p><ruby lang="ja"><rb>僕</rb><rp>(</rp><rt>ぼく</rt><rp>)</rp><rb>は</rb></ruby> the first paragraph.</p>
        <p>I'm the second paragraph.</p>
        <p>I'm the third paragraph.</p>
      </article>
    `).window;

    assert.equal(checkForRubyAnnotations(document), true);
  });
});

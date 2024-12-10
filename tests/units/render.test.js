import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import render from '../../lib/render.js';

const URL = process.env.URL;

describe('render', () => {
  it('is a function', () => {
    assert.equal(typeof render, 'function');
  });

  it('returns rendered content', () => {
    const { content: rendered } = render('a paragraph', URL);

    assert.equal(rendered.trim(), '<p>a paragraph</p>');
  });

  it('renders $$ delimited blocks labelled as math with an annotation containing original maths', () => {
    const { content: rendered } = render('$$\na=b\n$$', URL);

    const { window: { document } } = new JSDOM(rendered);
    const $math = document.querySelector('math');

    const $original = $math.querySelector('annotation[encoding="application/x-tex"]');

    assert.equal($original.textContent, 'a=b');
  });

  describe('mathematics with dollar delimiters', () => {
    it('removes inline style from rendered mathematics', () => {
      const { content: rendered } = render('$$\na=b\n$$', URL);

      const { window: { document } } = new JSDOM(rendered);

      assert.equal(document.querySelectorAll('math[style]').length, 0);
    });

    it('updates the ID of the title of the rendered mathematics', () => {
      const { content: rendered } = render('$$\na=b\n$$', URL);

      const { window: { document } } = new JSDOM(rendered);
      const math = document.querySelector('math');

      assert.equal(math.id, 'equation-1');
    });

    it('increments the title ID to avoid collisions', () => {
      const { content: rendered } = render('$$\na=b\n$$\n\ntext\n\n$$\nc=d\n$$', URL);
      const { window: { document } } = new JSDOM(rendered);
      const maths = document.querySelectorAll('math');

      assert.equal(maths.length, 2);
      assert.equal(maths[0].id, 'equation-1');
      assert.equal(maths[1].id, 'equation-2');
    });

    it('sets aria-label to the original math for each snipped', () => {
      const { content: rendered } = render('$$\na=b\n$$\n\ntext\n\n$$\nc=d\n$$', URL);

      const { window: { document } } = new JSDOM(rendered);
      const maths = document.querySelectorAll('math');

      assert.equal(maths[0].getAttribute('aria-label'), 'a=b');
      assert.equal(maths[1].getAttribute('aria-label'), 'c=d');
    });
  });

  describe('inline mathematics with single dollar delimiters', () => {
    const { content: rendered } = render('hello $a$ world', URL);

    assert.equal(rendered.trim(), '<p>hello <math><mi>a</mi></math> world</p>');
  });

  describe('inline ruby links', () => {
    it('renders ruby elements', () => {
      const { content: rendered } = render('^買,か,いに,,行,い,く,^', URL);
      const { window: { document } } = new JSDOM(rendered);
      const $rubies = document.getElementsByTagName('ruby');

      assert.equal($rubies.length, 1);

      assert.equal($rubies[0].outerHTML, [
        '<ruby>',
        '買<rp>(</rp><rt>か</rt><rp>)</rp>',
        'いに<rt></rt>',
        '行<rp>(</rp><rt>い</rt><rp>)</rp>',
        'く<rt></rt>',
        '</ruby>'
      ].join(''));
    });
  });

  describe('highlighted text', () => {
    it('renders text surrounded by pairs of == in mark tags', () => {
      const { content: rendered } = render('==start==, ==middle== and ==end==.');

      assert.equal(rendered.trim(), '<p><mark>start</mark>, <mark>middle</mark> and <mark>end</mark>.</p>');
    });

    it('renders highlighted text inside another inline element', () => {
      const { content: rendered } = render('_==text==_');

      assert.equal(rendered.trim(), '<p><em><mark>text</mark></em></p>');
    });

    it('renders highlighted text with another inline element within', () => {
      const { content: rendered } = render('==_text_==');

      assert.equal(rendered.trim(), '<p><mark><em>text</em></mark></p>');
    });
  });

  describe('lang attributes', () => {
    it('retains spans with a lang attribute when they have no child elements (only text nodes)', () => {
      const { content: rendered } = render('{ab:xyz} def');

      assert.equal(rendered.trim(), '<p><span lang="ab">xyz</span> def</p>');
    });

    it('removes the span when the span has an element as its single child node and copies over the lang attribute', () => {
      const { content: rendered } = render('{ab:*xyz*}');

      assert.equal(rendered.trim(), '<p><em lang="ab">xyz</em></p>');
    });

    it('retains spans with lang attributes when they have more than one node', () => {
      const { content: rendered } = render('{ab:*xx* yy} zz');

      assert.equal(rendered.trim(), '<p><span lang="ab"><em>xx</em> yy</span> zz</p>');
    });

    it('moves the lang and children of the span to its parent element when the parent element has the span as its only child', () => {
      const { content: rendered } = render('{ab:xyz *lmn*}');

      assert.equal(rendered.trim(), '<p lang="ab">xyz <em>lmn</em></p>');
    });
  });

  describe('footnotes', () => {
    it('links the footnote text to the location of the footnote', () => {
      const { content: rendered } = render('abc[^][a footnote] def');
      const { window: { document } } = new JSDOM(rendered, { url: 'http://example.test/' });

      const footnoteRefAnchor = document.querySelector('p a');

      assert.equal(footnoteRefAnchor.id, 'footnote-ref-1');
    });

    it('renders the footnote ref as superscript with a number in square brackets', () => {
      const { content: rendered } = render('abc[^][a footnote] def');
      const { window: { document } } = new JSDOM(rendered);
      const content = document.querySelector('p').outerHTML;

      assert.equal(content, '<p>abc<sup class="footnote-ref"><a id="footnote-ref-1" href="#footnote-1">[1]</a></sup> def</p>');
    });

    it('renders footnotes', () => {
      const { footnotes } = render('abc[^][a _footnote_] def');

      assert.equal(footnotes.length, 1);
      assert.equal(footnotes[0], 'a <em>footnote</em>');
    });

    it('labels each ref sequentially', () => {
      const { content: rendered } = render('abc[^][fn 1] def[^][fn 2] ghi');
      const { window: { document } } = new JSDOM(rendered, { url: 'http://example.test/' });

      const footnoteRefAnchors = document.querySelectorAll('p a');

      assert.equal(footnoteRefAnchors.length, 2);

      assert.equal(footnoteRefAnchors[0].textContent, '[1]');
      assert.equal(footnoteRefAnchors[1].textContent, '[2]');

      assert.equal(footnoteRefAnchors[0].id, 'footnote-ref-1');
      assert.equal(footnoteRefAnchors[1].id, 'footnote-ref-2');

      assert.equal(footnoteRefAnchors[0].href, 'http://example.test/#footnote-1');
      assert.equal(footnoteRefAnchors[1].href, 'http://example.test/#footnote-2');
    });
  });
});

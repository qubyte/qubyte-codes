import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import render from '../../lib/render.js';

const URL = process.env.URL;

describe('render', () => {
  it('is a function', () => {
    assert.equal(typeof render, 'function');
  });

  it('returns rendered content', () => {
    const rendered = render('a paragraph', URL);

    assert.equal(rendered.trim(), '<p>a paragraph</p>');
  });

  it('renders $$ delimited blocks labelled as SVG in the img role and a title containing the original maths', () => {
    const rendered = render('$$\na=b\n$$', URL);

    const { window: { document } } = new JSDOM(rendered);
    const $svg = document.querySelector('svg');

    assert.equal($svg.getAttribute('role'), 'img');

    const $title = $svg.querySelector('title');

    assert.equal($title.textContent, 'a=b');
  });

  describe('mathematics with dollar delimiters', () => {
    it('removes inline style from rendered mathematics', () => {
      const rendered = render('$$\na=b\n$$', URL);

      const { window: { document } } = new JSDOM(rendered);

      assert.equal(document.querySelectorAll('svg[style]').length, 0);
    });

    it('updates the ID of the title of the rendered mathematics', () => {
      const rendered = render('$$\na=b\n$$', URL);

      const { window: { document } } = new JSDOM(rendered);
      const titles = document.querySelectorAll('svg title[id]');

      assert.equal(titles.length, 1);
      assert.equal(titles[0].id, 'equation-1');
    });

    it('increments the title ID to avoid collisions', () => {
      const rendered = render('$$\na=b\n$$\n\ntext\n\n$$\nc=d\n$$', URL);
      const { window: { document } } = new JSDOM(rendered);
      const titles = document.querySelectorAll('svg title[id]');

      assert.equal(titles.length, 2);
      assert.equal(titles[0].id, 'equation-1');
      assert.equal(titles[1].id, 'equation-2');
    });

    it('sets aria-labelledby to the title element ID for each snipped', () => {
      const rendered = render('$$\na=b\n$$\n\ntext\n\n$$\nc=d\n$$', URL);

      const { window: { document } } = new JSDOM(rendered);
      const svgs = document.querySelectorAll('svg');

      assert.equal(svgs[0].getAttribute('aria-labelledby'), 'equation-1');
      assert.equal(svgs[1].getAttribute('aria-labelledby'), 'equation-2');
    });
  });

  describe('inline ruby links', () => {
    it('renders ruby elements', () => {
      const rendered = render('^買,か,いに,,行,い,く,^', URL).trim();
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
      const rendered = render('==start==, ==middle== and ==end==.').trim();

      assert.equal(rendered, '<p><mark>start</mark>, <mark>middle</mark> and <mark>end</mark>.</p>');
    });

    it('renders highlighted text inside another inline element', () => {
      const rendered = render('_==text==_').trim();

      assert.equal(rendered, '<p><em><mark>text</mark></em></p>');
    });

    it('renders highlighted text with another inline element within', () => {
      const rendered = render('==_text_==').trim();

      assert.equal(rendered, '<p><mark><em>text</em></mark></p>');
    });
  });

  describe('lang attributes', () => {
    it('retains spans with a lang attribute when they have no child elements (only text nodes)', () => {
      const rendered = render('{ab:xyz} def').trim();

      assert.equal(rendered, '<p><span lang="ab">xyz</span> def</p>');
    });

    it('removes the span when the span has an element as its single child node and copies over the lang attribute', () => {
      const rendered = render('{ab:*xyz*}').trim();

      assert.equal(rendered, '<p><em lang="ab">xyz</em></p>');
    });

    it('retains spans with lang attributes when they have more than one node', () => {
      const rendered = render('{ab:*xx* yy} zz').trim();

      assert.equal(rendered, '<p><span lang="ab"><em>xx</em> yy</span> zz</p>');
    });

    it('moves the lang and children of the span to its parent element when the parent element has the span as its only child', () => {
      const rendered = render('{ab:xyz *lmn*}').trim();

      assert.equal(rendered, '<p lang="ab">xyz <em>lmn</em></p>');
    });
  });

  describe('footnotes', () => {
    it('does not add a footnotes section when there are no footnotes', () => {
      const rendered = render('abc def').trim();
      const { window: { document } } = new JSDOM(rendered);

      assert.equal(document.querySelector('.footnotes'), null);
    });

    it('places the text of a footnote in a footnotes section', () => {
      const rendered = render('abc[^][a footnote] def').trim();
      const { window: { document } } = new JSDOM(rendered);

      assert.ok(document.querySelector('.footnotes li')?.textContent.includes('a footnote'));
    });

    it('renders inline markdown in footnote text', () => {
      const rendered = render('abc[^][a _footnote_ with markdown] def');
      const { window: { document } } = new JSDOM(rendered);

      assert.ok(document.querySelector('.footnotes li')?.innerHTML.includes('a <em>footnote</em> with markdown'));
    });

    it('links the location of the footnote to the footnote text', () => {
      const rendered = render('abc[^][a footnote] def').trim();
      const { window: { document } } = new JSDOM(rendered, { url: 'http://example.test/' });

      const anchor = document.querySelector('p a');
      const footnote = document.querySelector('.footnotes li');

      assert.equal(footnote.id, 'footnote-1');
      assert.equal(anchor.href, 'http://example.test/#footnote-1');
    });

    it('links the footnote text to the location of the footnote', () => {
      const rendered = render('abc[^][a footnote] def').trim();
      const { window: { document } } = new JSDOM(rendered, { url: 'http://example.test/' });

      const footnoteTextAnchor = document.querySelector('.footnotes li a');
      const footnoteRefAnchor = document.querySelector('p a');

      assert.equal(footnoteRefAnchor.id, 'footnote-ref-1');
      assert.equal(footnoteTextAnchor.href, 'http://example.test/#footnote-ref-1');
    });

    it('renders the footnote ref as superscript with a number in square brackets', () => {
      const rendered = render('abc[^][a footnote] def').trim();
      const { window: { document } } = new JSDOM(rendered);
      const content = document.querySelector('p').outerHTML;

      assert.equal(content, '<p>abc<sup><a id="footnote-ref-1" class="footnote-ref" href="#footnote-1">[1]</a></sup> def</p>');
    });

    it('renders the footnote ref with a reverse link at the end', () => {
      const rendered = render('abc[^][a footnote] def').trim();
      const { window: { document } } = new JSDOM(rendered);
      const content = document.querySelector('li').outerHTML;

      assert.equal(content, '<li id="footnote-1">a footnote<a class="footnote-back-link" href="#footnote-ref-1">ꜛ</a></li>');
    });

    it('labels each ref sequentially', () => {
      const rendered = render('abc[^][fn 1] def[^][fn 2] ghi').trim();
      const { window: { document } } = new JSDOM(rendered, { url: 'http://example.test/' });

      const footnoteRefAnchors = document.querySelectorAll('p a');
      const footnoteTexts = document.querySelectorAll('.footnotes ol li');
      const footnoteTextAnchors = document.querySelectorAll('.footnotes ol li a');

      assert.equal(footnoteRefAnchors.length, 2);
      assert.equal(footnoteTexts.length, 2);
      assert.equal(footnoteTextAnchors.length, 2);

      assert.equal(footnoteRefAnchors[0].textContent, '[1]');
      assert.equal(footnoteRefAnchors[1].textContent, '[2]');

      assert.equal(footnoteRefAnchors[0].id, 'footnote-ref-1');
      assert.equal(footnoteRefAnchors[1].id, 'footnote-ref-2');

      assert.equal(footnoteTexts[0].id, 'footnote-1');
      assert.equal(footnoteTexts[1].id, 'footnote-2');

      assert.equal(footnoteRefAnchors[0].href, 'http://example.test/#footnote-1');
      assert.equal(footnoteRefAnchors[1].href, 'http://example.test/#footnote-2');

      assert.equal(footnoteTextAnchors[0].href, 'http://example.test/#footnote-ref-1');
      assert.equal(footnoteTextAnchors[1].href, 'http://example.test/#footnote-ref-2');
    });
  });
});

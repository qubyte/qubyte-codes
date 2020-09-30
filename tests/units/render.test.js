'use strict';

const assert = require('assert').strict;
const { JSDOM } = require('jsdom');
const render = require('../../lib/render');
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
    const rendered = render('\\[\na=b\n\\]', URL);

    const { window: { document } } = new JSDOM(rendered);
    const $svg = document.querySelector('svg');

    assert.equal($svg.getAttribute('role'), 'img');

    const $title = $svg.querySelector('title');

    assert.equal($title.textContent, 'a=b');
  });

  describe('mathematics blocks with brace delimeters', () => {
    it('removes inline style from rendered mathematics', () => {
      const rendered = render('\\[\na=b\n\\]', URL);

      const { window: { document } } = new JSDOM(rendered);

      assert.equal(document.querySelectorAll('svg[style]').length, 0);
    });

    it('updates the ID of the title of the rendered mathematics', () => {
      const rendered = render('\\[\na=b\n\\]', URL);

      const { window: { document } } = new JSDOM(rendered);
      const titles = document.querySelectorAll('svg title[id]');

      assert.equal(titles.length, 1);
      assert.equal(titles[0].id, 'equation-1');
    });

    it('increments the title ID to avoid collisions', () => {
      const rendered = render('\\[\na=b\n\\]\n\ntext\n\n\\[\nc=d\n\\]', URL);
      const { window: { document } } = new JSDOM(rendered);
      const titles = document.querySelectorAll('svg title[id]');

      assert.equal(titles.length, 2);
      assert.equal(titles[0].id, 'equation-1');
      assert.equal(titles[1].id, 'equation-2');
    });

    it('sets aria-labelledby to the title element ID for each snipped', () => {
      const rendered = render('\\[\na=b\n\\]\n\ntext\n\n\\[\nc=d\n\\]', URL);

      const { window: { document } } = new JSDOM(rendered);
      const svgs = document.querySelectorAll('svg');

      assert.equal(svgs[0].getAttribute('aria-labelledby'), 'equation-1');
      assert.equal(svgs[1].getAttribute('aria-labelledby'), 'equation-2');
    });
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
});

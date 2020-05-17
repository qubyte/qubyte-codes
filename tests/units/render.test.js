'use strict';

const assert = require('assert').strict;
const { JSDOM } = require('jsdom');
const render = require('../../lib/render');
const URL = process.env.URL;

describe('render', () => {
  it('is a function', () => {
    assert.equal(typeof render, 'function');
  });

  it('returns a promise', () => {
    const result = render('', URL);

    assert.ok(result instanceof Promise);
  });

  it('resolves to rendered content', async () => {
    const rendered = await render('a paragraph', URL);

    assert.equal(rendered.trim(), '<p>a paragraph</p>');
  });

  it('renders fenced blocks labelled as SVG in the img role and a title containing the original maths', async () => {
    const rendered = await render('```mathematics\na=b\n```', URL);

    const { window: { document } } = new JSDOM(rendered);
    const $svg = document.querySelector('svg');

    assert.equal($svg.getAttribute('role'), 'img');

    const $title = $svg.querySelector('title');

    assert.equal($title.textContent, 'a=b');
  });

  it('removes inline style from rendered mathematics', async () => {
    const rendered = await render('```mathematics\na=b\n```', URL);

    const { window: { document } } = new JSDOM(rendered);

    assert.equal(document.querySelectorAll('svg[style]').length, 0);
  });

  it('updates the ID of the title of the rendered mathematics', async () => {
    const rendered = await render('```mathematics\na=b\n```', URL);

    const { window: { document } } = new JSDOM(rendered);
    const titles = document.querySelectorAll('svg title[id]');

    assert.equal(titles.length, 1);
    assert.equal(titles[0].id, 'equation-1');
  });

  it('increments the title ID to avoid collisions', async () => {
    const rendered = await render('```mathematics\na=b\n```\ntext\n```mathematics\nc=d\n```', URL);

    const { window: { document } } = new JSDOM(rendered);
    const titles = document.querySelectorAll('svg title[id]');

    assert.equal(titles.length, 2);
    assert.equal(titles[0].id, 'equation-1');
    assert.equal(titles[1].id, 'equation-2');
  });

  it('sets aria-labelledby to the title element ID for each snipped', async () => {
    const rendered = await render('```mathematics\na=b\n```\ntext\n```mathematics\nc=d\n```', URL);

    const { window: { document } } = new JSDOM(rendered);
    const svgs = document.querySelectorAll('svg');

    assert.equal(svgs[0].getAttribute('aria-labelledby'), 'equation-1');
    assert.equal(svgs[1].getAttribute('aria-labelledby'), 'equation-2');
  });
});

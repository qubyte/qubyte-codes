'use strict';

const assert = require('assert').strict;
const cheerio = require('cheerio');
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

  it('does not append target="_blank" or rel="noopener" attributes to anchors for absolute URLs within the site', async () => {
    const rendered = await render(`[a link within the site](${process.env.URL}a/path)`, URL);

    const $ = cheerio.load(rendered);
    const $a = $('a');

    assert.equal($a.attr('href'), `${process.env.URL}a/path`);
    assert.equal($a.attr('target'), undefined);
    assert.equal($a.attr('rel'), undefined);
  });

  it('does not append target="_blank" or rel="noopener" attributes to anchors for local URLs', async () => {
    const rendered = await render('[a link within the site](/a/path)', URL);

    const $ = cheerio.load(rendered);
    const $a = $('a');

    assert.equal($a.attr('href'), '/a/path');
    assert.equal($a.attr('target'), undefined);
    assert.equal($a.attr('rel'), undefined);
  });

  it('does not append target="_blank" or rel="noopener" attributes to anchors for relative URLs', async () => {
    const rendered = await render('[a link within the site](./a/path)', URL);

    const $ = cheerio.load(rendered);
    const $a = $('a');

    assert.equal($a.attr('href'), './a/path');
    assert.equal($a.attr('target'), undefined);
    assert.equal($a.attr('rel'), undefined);
  });

  it('appends target="_blank" and rel="noopener" attributes to anchors for URLs to other sites', async () => {
    const rendered = await render('[a link within the site](https://example.com/a/path)', URL);

    const $ = cheerio.load(rendered);
    const $a = $('a');

    assert.equal($a.attr('href'), 'https://example.com/a/path');
    assert.equal($a.attr('target'), '_blank');
    assert.equal($a.attr('rel'), 'noopener');
  });

  it('renders fenced blocks labelled as SVG in the img role and a title containing the original maths', async () => {
    const rendered = await render('```mathematics\na=b\n```', URL);

    const $ = cheerio.load(rendered);
    const $svg = $('svg');

    assert.equal($svg.attr('role'), 'img');

    const $title = $('svg > title');

    assert.equal($title.text(), 'a=b');
  });

  it('removes inline style from rendered mathematics', async () => {
    const rendered = await render('```mathematics\na=b\n```', URL);

    const $ = cheerio.load(rendered);

    assert.equal($('svg[style]').length, 0);
  });

  it('updates the ID of the title of the rendered mathematics', async () => {
    const rendered = await render('```mathematics\na=b\n```', URL);

    const $ = cheerio.load(rendered);
    const titles = $('svg title[id]');

    assert.equal(titles.length, 1);
    assert.equal($(titles[0]).attr('id'), 'maths-snippet-0');
  });

  it('increments the title ID to avoid collisions', async () => {
    const rendered = await render('```mathematics\na=b\n```\ntext\n```mathematics\nc=d\n```', URL);

    const $ = cheerio.load(rendered);
    const titles = $('svg title[id]');

    assert.equal(titles.length, 2);
    assert.equal($(titles[0]).attr('id'), 'maths-snippet-0');
    assert.equal($(titles[1]).attr('id'), 'maths-snippet-1');
  });

  it('sets aria-labelledby to the title element ID for each snipped', async () => {
    const rendered = await render('```mathematics\na=b\n```\ntext\n```mathematics\nc=d\n```', URL);

    const $ = cheerio.load(rendered);
    const svgs = $('svg');

    assert.equal($(svgs[0]).attr('aria-labelledby'), 'maths-snippet-0');
    assert.equal($(svgs[1]).attr('aria-labelledby'), 'maths-snippet-1');
  });
});

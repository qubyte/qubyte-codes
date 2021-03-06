'use strict';

const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

module.exports = async function getTagsForUrl(url) {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Unexpected status code when fetching post: ${res.status}`);
  }

  const content = await res.text();
  const { window: { document } } = new JSDOM(content);
  const $tags = document.querySelectorAll('[rel="tag"]');

  return Array.from($tags).map(el => el.textContent.trim());
};

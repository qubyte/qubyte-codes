'use strict';

const makeSnippet = require('./make-snippet');
const render = require('./render');

// Appends markdown into HTML ready to place in a template to a post object.
// Also appends a snippet and a canonical URL.
module.exports = async function appendPostContent(post, baseUrl) {
  post.content = await render(post.body, baseUrl);
  post.snippet = makeSnippet(post.content);
  post.canonical = `${baseUrl}${post.localUrl}`;

  return post;
};

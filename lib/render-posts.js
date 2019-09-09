'use strict';

module.exports = function renderPosts(posts, blogTemplate, cssPath, dev) {
  const rendered = [];

  for (let i = 0; i < posts.length; i++) {
    const previous = posts[i - 1];
    const post = posts[i];
    const next = posts[i + 1];
    const renderObject = { ...post, cssPath, dev };

    if (previous) {
      renderObject.prevLink = previous.localUrl;
    }

    if (next) {
      renderObject.nextLink = next.localUrl;
    }

    rendered.push({
      html: blogTemplate(renderObject),
      filename: post.filename
    });
  }

  return rendered;
};

'use strict';

module.exports = function renderLinks(likes, likeTemplate, cssPath, dev) {
  const rendered = [];

  for (let i = 0; i < likes.length; i++) {
    const previous = likes[i - 1];
    const like = likes[i];
    const next = likes[i + 1];
    const renderObject = { ...like, cssPath, dev, title: 'Like' };

    if (previous) {
      renderObject.prevLike = previous.localUrl;
    }

    if (next) {
      renderObject.nextLike = next.localUrl;
    }

    rendered.push({
      html: likeTemplate(renderObject),
      filename: `${like.timestamp}.html`
    });
  }

  return rendered;
};

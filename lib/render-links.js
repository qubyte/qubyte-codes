'use strict';

module.exports = function renderLinks(links, linkTemplate, cssPath, dev) {
  const rendered = [];

  for (let i = 0; i < links.length; i++) {
    const previous = links[i - 1];
    const link = links[i];
    const next = links[i + 1];
    const renderObject = { ...link, cssPath, dev, title: 'Link' };

    if (previous) {
      renderObject.prevLink = previous.localUrl;
    }

    if (next) {
      renderObject.nextLink = next.localUrl;
    }

    rendered.push({
      html: linkTemplate(renderObject),
      filename: `${link.timestamp}.html`
    });
  }

  return rendered;
};

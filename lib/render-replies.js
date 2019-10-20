'use strict';

module.exports = function renderReplies(replies, replyTemplate, cssPath, dev) {
  const rendered = [];

  for (let i = 0; i < replies.length; i++) {
    const previous = replies[i - 1];
    const reply = replies[i];
    const next = replies[i + 1];
    const renderObject = { ...reply, cssPath, dev, title: 'Reply' };

    if (previous) {
      renderObject.prevLink = previous.localUrl;
    }

    if (next) {
      renderObject.nextLink = next.localUrl;
    }

    rendered.push({
      html: replyTemplate(renderObject),
      filename: `${reply.timestamp}.html`
    });
  }

  return rendered;
};

'use strict';

const highlight = require('highlight.js');

// Patch JS renderer for protocols proposal.
{
  const js = highlight.getLanguage('javascript');
  js.keywords.keyword += ' implements';

  const jsClass = js.contains.find(c => c.className === 'class');
  jsClass.contains.find(c => c.beginKeywords.includes('extends')).beginKeywords += ' implements';

  const jsProtocol = Object.assign({}, jsClass, { className: 'protocol', beginKeywords: 'protocol' });

  js.contains.push(jsProtocol);
}

const marked = require('marked');
const urlResolve = require('url').resolve;
const baseUrl = require('./baseUrl');
const renderer = new marked.Renderer();
const oldLinkRenderer = renderer.link;

// Make links to external sites safe.
renderer.link = (href, title, text) => {
  const fullyQualified = urlResolve(baseUrl, href);
  const rendered = oldLinkRenderer.call(renderer, href, title, text);

  if (fullyQualified.startsWith(baseUrl)) {
    return rendered;
  }

  return rendered.replace('<a ', '<a target="_blank" rel="noopener" ');
};

marked.setOptions({
  highlight(code, language) {
    return highlight.highlight(language, code).value;
  },
  renderer
});

module.exports = marked;

// @ts-check

import Page from './page.js';

class TagPage extends Page {
  /**
   * @param {object} options
   * @param {string|URL} options.baseUrl
   * @param {string} options.localUrl
   * @param {string} options.content
   * @param {string} options.filename
   * @param {string} options.name
   */
  constructor({ baseUrl, localUrl, content, filename, name }) {
    super({ baseUrl, localUrl, content, filename });
    this.name = name;
  }
}

// Compiles a list of tags from post metadata.
export default function collateTags({ posts, cssPath, baseUrl, dev, template }) {
  const tags = {};

  for (const post of posts) {
    for (const tag of post.tags || []) {
      if (!tags[tag]) {
        tags[tag] = [];
      }

      tags[tag].push(post);
    }
  }

  return Object.entries(tags).map(([name, posts]) => {
    const localUrl = `/tags/${name}`;

    return new TagPage({
      baseUrl,
      localUrl,
      content: template({ posts, tag: name, localUrl, cssPath, baseUrl, dev, title: `Posts tagged as ${name}` }),
      filename: `${name}.html`,
      name
    });
  });
}

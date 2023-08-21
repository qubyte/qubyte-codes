// Compiles a list of tags from post metadata.
export default function collateTags({ posts, cssPath, baseUrl, dev, template }) {
  const tags = {};

  for (const post of posts) {
    for (const tag of post.tags || []) {
      tags[tag] ||= [];
      tags[tag].push(post);
    }
  }

  return Object.entries(tags).map(([name, posts]) => {
    const localUrl = `/tags/${name}`;

    return {
      name,
      localUrl: `/tags/${name}`,
      html: template({ posts, tag: name, localUrl, cssPath, baseUrl, dev, title: `Posts tagged as ${name}` }),
      filename: `${name}.html`
    };
  });
}

'use strict';

const path = require('path');
const loadTemplates = require('./lib/templates');
const generateCss = require('./lib/generate-css');
const loadPostFiles = require('./lib/load-post-files');
const loadNoteFiles = require('./lib/load-note-files');
const loadLinkFiles = require('./lib/load-link-files');
const renderPosts = require('./lib/render-posts');
const renderNotes = require('./lib/render-notes');
const renderLinks = require('./lib/render-links');
const getLastCommitTime = require('./lib/get-last-commit-time');
const { promises: { mkdir, writeFile } } = require('fs');
const cpy = require('cpy');
const publications = require('./src/publications');

// Compiles a list of tags from post metadata.
function collateTags(posts, cssPath, dev, template) {
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

    return {
      name,
      localUrl: `/tags/${name}`,
      rendered: template({ posts, tag: name, localUrl, cssPath, dev, title: `Posts tagged as ${name}` }),
      filename: `${name}.html`
    };
  });
}

// Copies static files and directories to a fresh public directory.
async function copyFiles(source, target) {
  await mkdir(target);

  await Promise.all([
    mkdir(path.join(target, 'blog')),
    mkdir(path.join(target, 'notes')),
    mkdir(path.join(target, 'links')),
    mkdir(path.join(target, 'tags')),
    cpy(path.join(source, 'icons', '*.png'), path.join(target, 'icons')),
    cpy(path.join(source, 'fonts', '*'), path.join(target, 'fonts')),
    cpy(path.join(source, 'img', '*'), path.join(target, 'img')),
    cpy(path.join(__dirname, 'content', 'scripts', '*.js'), path.join(target, 'scripts')),
    cpy(path.join(__dirname, 'content', 'papers', '*'), path.join(target, 'papers')),
    cpy(path.join(__dirname, 'content', 'notes-media', '*'), path.join(target, 'notes-media')),
    cpy(
      ['google*', 'keybase.txt', 'robots.txt', 'index.js', 'sw.js', 'manifest.json'].map(n => path.join(source, n)),
      target
    )
  ]);
}

// This is where it all kicks off. This function loads posts and templates,
// renders it all to files, and saves them to the public directory.

exports.build = async function build({ baseUrl, baseTitle, dev }) {
  const source = path.join(__dirname, 'src');
  const target = path.join(__dirname, 'public');
  const content = path.join(__dirname, 'content');

  const gettingLastContentCommitTime = getLastCommitTime(path.join(content));

  const [templates, posts, notes, links, cssPath] = await Promise.all([
    // Load and compile markdown template files into functions.
    loadTemplates(path.join(source, 'templates'), { baseTitle }),
    // Load markdown posts, render them to HTML content, and sort them by date descending.
    loadPostFiles(path.join(content, 'posts'), baseUrl),
    // Load short form notes, and reposts (links), render them to HTML content, and sort them by date descending.
    loadNoteFiles(path.join(content, 'notes')),
    loadLinkFiles(path.join(content, 'links')),
    // After creating the target directory structure, compile CSS to a single file, with a unique filename.
    copyFiles(source, target)
      .then(() => generateCss(path.join(source, 'css'), target, 'entry.css', 'default'))
  ]);

  // Make a list of tags found in posts.
  const tags = collateTags(posts, cssPath, dev, templates.tag);

  // Render various pages.
  const renderedPosts = renderPosts(posts, templates.blog, cssPath, dev);
  const renderedNotes = renderNotes(notes, templates.note, cssPath, dev);
  const renderedLinks = renderLinks(links, templates.link, cssPath, dev);
  const indexHtml = templates.index({ posts, cssPath, dev, localUrl: '/', title: 'Archive' });
  const notesHtml = templates.notes({ notes, cssPath, dev, localUrl: '/notes', title: 'Notes' });
  const linksHtml = templates.links({ links, cssPath, dev, localUrl: '/links', title: 'Links' });
  const aboutHtml = templates.about({ cssPath, dev, localUrl: '/about', title: 'About' });
  const publicationsHtml = templates.publications({ cssPath, dev, localUrl: '/publications', publications, title: 'Publications' });
  const fourOhFourHtml = templates[404]({ cssPath, dev, localUrl: '/404', title: 'Not Found' });
  const webmentionHtml = templates.webmention({ cssPath, dev, localUrl: '/webmention', title: 'Webmention' });

  // Render the site map.
  const sitemapTxt = templates.sitemap({ posts, tags, notes, links });
  const everything = [...posts, ...notes, ...links].sort((a, b) => b.timestamp - a.timestamp);

  // Render the atom feed.
  const atomXML = templates.atom({ items: everything, updated: await gettingLastContentCommitTime });

  // Write the rendered templates to the public directory.
  await Promise.all([
    writeFile(path.join(target, 'index.html'), indexHtml),
    writeFile(path.join(target, 'notes', 'index.html'), notesHtml),
    writeFile(path.join(target, 'links', 'index.html'), linksHtml),
    writeFile(path.join(target, 'about.html'), aboutHtml),
    writeFile(path.join(target, 'publications.html'), publicationsHtml),
    writeFile(path.join(target, 'webmention.html'), webmentionHtml),
    writeFile(path.join(target, '404.html'), fourOhFourHtml),
    ...renderedPosts.map(post => writeFile(path.join(target, 'blog', post.filename), post.html)),
    ...renderedNotes.map(note => writeFile(path.join(target, 'notes', note.filename), note.html)),
    ...renderedLinks.map(link => writeFile(path.join(target, 'links', link.filename), link.html)),
    ...tags.map(tag => writeFile(path.join(target, 'tags', tag.filename), tag.rendered)),
    writeFile(path.join(target, 'atom.xml'), atomXML),
    writeFile(path.join(target, 'sitemap.txt'), sitemapTxt)
  ]);
};

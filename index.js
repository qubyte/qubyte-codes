'use strict';

const path = require('path');
const loadTemplates = require('./lib/templates');
const buildPaths = require('./lib/build-paths');
const generateCss = require('./lib/generate-css');
const loadPostFiles = require('./lib/load-post-files');
const loadNoteFiles = require('./lib/load-note-files');
const loadLinkFiles = require('./lib/load-link-files');
const renderPosts = require('./lib/render-posts');
const renderNotes = require('./lib/render-notes');
const renderLinks = require('./lib/render-links');
const getLastPostCommitTime = require('./lib/get-last-commit-time');
const { promises: { mkdir, writeFile } } = require('fs');
const cpy = require('cpy');
const publications = require('./src/publications');

// Compiles a list of tags from post metadata.
function collateTags(posts, cssPath, dev, template) {
  const tags = {};

  for (const post of posts) {
    for (const tag of post.attributes.tags || []) {
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
async function copyFiles() {
  await mkdir(buildPaths.public());

  await Promise.all([
    mkdir(buildPaths.public('blog')),
    mkdir(buildPaths.public('notes')),
    mkdir(buildPaths.public('links')),
    mkdir(buildPaths.public('tags')),
    cpy(buildPaths.src('icons', '*.png'), buildPaths.public('icons')),
    cpy(buildPaths.src('fonts', '*'), buildPaths.public('fonts')),
    cpy(buildPaths.src('img', '*'), buildPaths.public('img')),
    cpy(path.join(__dirname, 'content', 'scripts', '*.js'), buildPaths.public('scripts')),
    cpy(path.join(__dirname, 'content', 'papers', '*'), buildPaths.public('papers')),
    cpy(path.join(__dirname, 'content', 'notes-media', '*'), buildPaths.public('notes-media')),
    cpy(
      ['google*', 'keybase.txt', 'robots.txt', 'index.js', 'sw.js', 'manifest.json'].map(n => buildPaths.src(n)),
      buildPaths.public()
    )
  ]);
}

// This is where it all kicks off. This function loads posts and templates,
// renders it all to files, and saves them to the public directory.

exports.build = async function build({ baseUrl, baseTitle, dev }) {
  const gettingLastPostCommitTime = getLastPostCommitTime(path.join(__dirname, 'content', 'posts'));

  const [templates, posts, notes, links, cssPath] = await Promise.all([
    // Load and compile markdown template files into functions.
    loadTemplates(path.join(__dirname, 'src', 'templates'), { baseTitle }),
    // Load markdown posts, render them to HTML content, and sort them by date descending.
    loadPostFiles(path.join(__dirname, 'content', 'posts'), baseUrl),
    // Load short form notes, and reposts (links), render them to HTML content, and sort them by date descending.
    loadNoteFiles(path.join(__dirname, 'content', 'notes')),
    loadLinkFiles(path.join(__dirname, 'content', 'links')),
    // After creating the target directory structure, compile CSS to a single file, with a unique filename.
    copyFiles().then(() => generateCss(path.join(__dirname, 'src', 'css'), 'entry.css', 'default'))
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

  // Render the atom feed.
  const atomXML = templates.atom({ posts, updated: await gettingLastPostCommitTime });

  // Write the rendered templates to the public directory.
  await Promise.all([
    writeFile(buildPaths.public('index.html'), indexHtml),
    writeFile(buildPaths.public('notes', 'index.html'), notesHtml),
    writeFile(buildPaths.public('links', 'index.html'), linksHtml),
    writeFile(buildPaths.public('about.html'), aboutHtml),
    writeFile(buildPaths.public('publications.html'), publicationsHtml),
    writeFile(buildPaths.public('webmention.html'), webmentionHtml),
    writeFile(buildPaths.public('404.html'), fourOhFourHtml),
    ...renderedPosts.map(post => writeFile(buildPaths.public('blog', post.filename), post.html)),
    ...renderedNotes.map(note => writeFile(buildPaths.public('notes', note.filename), note.html)),
    ...renderedLinks.map(link => writeFile(buildPaths.public('links', link.filename), link.html)),
    ...tags.map(tag => writeFile(buildPaths.public('tags', tag.filename), tag.rendered)),
    writeFile(buildPaths.public('atom.xml'), atomXML),
    writeFile(buildPaths.public('sitemap.txt'), sitemapTxt)
  ]);
};

'use strict';

const path = require('path');
const loadTemplates = require('./lib/templates');
const buildPaths = require('./lib/build-paths');
const generateCss = require('./lib/generate-css');
const loadPostFiles = require('./lib/load-post-files');
const { promises: { mkdir, readdir, readFile, writeFile } } = require('fs');
const cpy = require('cpy');
const exec = require('util').promisify(require('child_process').exec);
const publications = require('./src/publications');

async function loadNoteFile(filePath) {
  const note = await readFile(filePath, 'utf8');
  const parsed = new URLSearchParams(note);
  const content = parsed.get('content');

  return content;
}

async function loadNoteFiles() {
  const filenames = await readdir(path.join(__dirname, 'content', 'notes'));

  filenames.sort((a, b) => b - a);

  return Promise.all(filenames.map(async timestamp => {
    const filePath = path.join(__dirname, 'content', 'notes', timestamp);
    const content = await loadNoteFile(filePath);

    return {
      timestamp,
      localUrl: `/notes/${timestamp}`,
      datetime: new Date(parseInt(timestamp, 10)).toISOString(),
      content,
      type: 'note'
    };
  }));
}

async function loadLinkFile(filePath) {
  const link = await readFile(filePath, 'utf8');
  const parsed = new URLSearchParams(link);
  const bookmarkOf = parsed.get('bookmark-of');
  const repostOf = parsed.get('repost-of');
  const name = parsed.get('name');
  const content = parsed.get('content');

  return { bookmarkOf, repostOf, name, content };
}

async function loadLinkFiles() {
  const filenames = await readdir(path.join(__dirname, 'content', 'links'));

  filenames.sort((a, b) => b - a);

  return Promise.all(filenames.map(async timestamp => {
    const filePath = path.join(__dirname, 'content', 'links', timestamp);
    const { bookmarkOf, repostOf, name, content } = await loadLinkFile(filePath);

    return {
      timestamp,
      localUrl: `/links/${timestamp}`,
      datetime: new Date(parseInt(timestamp, 10)).toISOString(),
      bookmarkOf,
      repostOf,
      name,
      content,
      type: 'link'
    };
  }));
}

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

// Gets the date of the most recent edit to the post files.
async function getLastPostCommit() {
  const { stdout, stderr } = await exec('git log -1 --format=%ct content/posts');

  if (stderr) {
    throw new Error(`Error from exec: ${stderr}`);
  }

  return new Date(parseInt(stdout.trim(), 10) * 1000);
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

// Renders the blog template with each post.
function renderPosts(posts, blogTemplate, cssPath, dev) {
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
      filename: `${post.slug}.html`
    });
  }

  return rendered;
}

function renderNotes(notes, noteTemplate, cssPath, dev) {
  const rendered = [];

  for (let i = 0; i < notes.length; i++) {
    const previous = notes[i - 1];
    const note = notes[i];
    const next = notes[i + 1];
    const renderObject = { ...note, cssPath, dev, title: 'Note' };

    if (previous) {
      renderObject.prevLink = previous.localUrl;
    }

    if (next) {
      renderObject.nextLink = next.localUrl;
    }

    rendered.push({
      html: noteTemplate(renderObject),
      filename: `${note.timestamp}.html`
    });
  }

  return rendered;
}

function renderLinks(links, linkTemplate, cssPath, dev) {
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
}

// This is where it all kicks off. This function loads posts and templates,
// renders it all to files, and saves them to the public directory.

exports.build = async function build({ baseUrl, baseTitle, dev }) {
  const [templates] = await Promise.all([
    // Load and compile markdown template files into functions.
    loadTemplates({ baseTitle }),
    // Do this first, since it also creates the public directory tree.
    copyFiles()
  ]);

  const [posts, notes, links, cssPath, updated] = await Promise.all([
    // Load markdown posts, render them to HTML content, and sort them by date descending.
    loadPostFiles(baseUrl),
    // Load short form notes, and reposts (links), render them to HTML content, and sort them by date descending.
    loadNoteFiles(),
    loadLinkFiles(),
    // Compile CSS to a single file, with a unique filename.
    generateCss(path.join(__dirname, 'src', 'css'), 'entry.css', 'default'),
    // Get the timestamp for the last post update.
    getLastPostCommit()
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

  // Render the atom feed.
  const atomXML = templates.atom({ posts, updated });

  // Render the site map.
  const sitemapTxt = templates.sitemap({ posts, tags, links });

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

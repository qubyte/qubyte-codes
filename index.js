'use strict';

const frontMatter = require('front-matter');
const path = require('path');
const loadTemplates = require('./lib/templates');
const buildPaths = require('./lib/build-paths');
const createSlug = require('./lib/create-slug');
const render = require('./lib/render');
const generateCss = require('./lib/generate-css');
const { promises: { mkdir, readdir, readFile, writeFile } } = require('fs');
const cpy = require('cpy');
const cheerio = require('cheerio');
const exec = require('util').promisify(require('child_process').exec);
const publications = require('./src/publications');
const baseUrl = process.env.URL;

// Plucks and wraps the first paragraph out of post HTML to form a snippet.
function makeSnippet(rendered) {
  const innerHtml = cheerio.load(rendered)('p')
    .html()
    .slice(0, -1);

  return `<p class="quote">${innerHtml}</p>`;
}

// Renders markdown to an HTML snippet. Also calculates various data which will
// be used by templates.
async function loadPostFile(filePath) {
  const post = await readFile(filePath, 'utf8');
  const digested = frontMatter(post);
  const { title, datetime } = digested.attributes;

  digested.isBlogEntry = true;
  digested.slug = createSlug(title);
  digested.canonical = `${baseUrl}/blog/${digested.slug}`;
  digested.mastodonHandle = '@qubyte@mastodon.social';
  digested.content = await render(digested.body);
  digested.snippet = makeSnippet(digested.content);
  digested.title = `Qubyte Codes - ${title}`;
  digested.date = new Date(datetime);

  return digested;
}

// Loads and renders post source files and their metadata. Note, this renders
// content to HTML, but *not* pages. The HTML created here must be placed within
// a template to form a complete page.
async function loadPostFiles() {
  const filenames = await readdir(path.join(__dirname, 'content', 'posts'));
  const filePaths = filenames.map(filename => path.join(__dirname, 'content', 'posts', filename));

  const posts = await Promise.all(filePaths.map(loadPostFile));
  const now = Date.now();

  posts.sort((a, b) => b.date - a.date);

  return posts.filter(post => post.date.getTime() < now && !post.attributes.draft);
}

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

    return { timestamp, datetime: new Date(parseInt(timestamp, 10)).toISOString(), content };
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

  return Object.entries(tags).map(([name, posts]) => ({
    name,
    rendered: template({ posts, tag: name, cssPath, dev, title: `Qubyte Codes - Posts tagged as ${name}` }),
    filename: `${name}.html`
  }));
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
      renderObject.prevLink = `/blog/${previous.slug}`;
    }

    if (next) {
      renderObject.nextLink = `/blog/${next.slug}`;
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
    const renderObject = { ...note, cssPath, dev };

    if (previous) {
      renderObject.prevLink = `/notes/${previous.timestamp}`;
    }

    if (next) {
      renderObject.nextLink = `/notes/${next.timestamp}`;
    }

    rendered.push({
      html: noteTemplate(renderObject),
      filename: `${note.timestamp}.html`
    });
  }

  return rendered;
}

// This is where it all kicks off. This function loads posts and templates,
// renders it all to files, and saves them to the public directory.

exports.build = async function build(dev) {
  const [templates] = await Promise.all([
    // Load and compile markdown template files into functions.
    loadTemplates(),
    // Do this first, since it also creates the public directory tree.
    copyFiles()
  ]);

  const [posts, notes, cssPath, updated] = await Promise.all([
    // Load markdown posts, render them to HTML content, and sort them by date descending.
    loadPostFiles(),
    // Load short form notes, render them to HTML content, and sort them by date descending.
    loadNoteFiles(),
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
  const indexHtml = templates.index({ posts, cssPath, dev, title: 'Qubyte Codes' });
  const notesHtml = templates.notes({ notes, cssPath, dev, title: 'Qubyte Codes - Notes' });
  const aboutHtml = templates.about({ cssPath, dev, title: 'Qubyte Codes - about' });
  const publicationsHtml = templates.publications({ cssPath, dev, publications });
  const fourOhFourHtml = templates[404]({ cssPath, dev, title: 'Qubyte Cods - Not Found' });
  const webmentionHtml = templates.webmention({ cssPath, dev, title: 'Qubyte Codes - webmention' });

  // Render the atom feed.
  const atomXML = templates.atom({ posts, updated });

  // Render the site map.
  const sitemapTxt = templates.sitemap({ posts, tags });

  // Write the rendered templates to the public directory.
  await Promise.all([
    writeFile(buildPaths.public('index.html'), indexHtml),
    writeFile(buildPaths.public('notes', 'index.html'), notesHtml),
    writeFile(buildPaths.public('about.html'), aboutHtml),
    writeFile(buildPaths.public('publications.html'), publicationsHtml),
    writeFile(buildPaths.public('webmention.html'), webmentionHtml),
    writeFile(buildPaths.public('404.html'), fourOhFourHtml),
    ...renderedPosts.map(post => writeFile(buildPaths.public('blog', post.filename), post.html)),
    ...renderedNotes.map(note => writeFile(buildPaths.public('notes', note.filename), note.html)),
    ...tags.map(tag => writeFile(buildPaths.public('tags', tag.filename), tag.rendered)),
    writeFile(buildPaths.public('atom.xml'), atomXML),
    writeFile(buildPaths.public('sitemap.txt'), sitemapTxt)
  ]);
};

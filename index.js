'use strict';

const CleanCss = require('clean-css');
const frontMatter = require('front-matter');
const path = require('path');
const crypto = require('crypto');
const handlebars = require('handlebars');
const makeSlug = require('slug');
const makeRenderer = require('./lib/render');
const fs = require('fs');
const { promisify } = require('util');
const cpy = require('cpy');
const cheerio = require('cheerio');
const exec = promisify(require('child_process').exec);

// Promisified variants of native file system methods allow me to use
// async-await, avoiding the need for lots of callbacks.
const mkdir = promisify(fs.mkdir);
const readDir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

// A helper to turn a datetime into a human readable string.
handlebars.registerHelper('humanDate', datetime => {
  return new Date(datetime).toDateString();
});

// A helper to turn a datetime into an ISO string (without milliseconds).
handlebars.registerHelper('isoDate', datetime => {
  return new Date(datetime)
    .toISOString()
    .replace(/\.[0-9]{3}Z/, 'Z');
});

// A helper function so I can avoid writing a bunch of path joins to src.
function buildSrcPath(...parts) {
  return path.join(__dirname, 'src', ...parts);
}

// A helper function so I can avoid writing a bunch of path joins to public.
function buildPublicPath(...parts) {
  return path.join(__dirname, 'public', ...parts);
}

// Compiles and calculates a unique filename for CSS.
async function generateCss(cssEntryPath) {
  const content = new CleanCss().minify([cssEntryPath]);

  const hash = crypto
    .createHash('md5')
    .update(content.styles)
    .digest('hex');

  const cssPath = buildPublicPath(`main-${hash}.css`);

  await writeFile(cssPath, content.styles);

  return `/main-${hash}.css`;
}

// Loads and renders a partial template.
async function loadPartial(filename) {
  const [name] = filename.split('.');
  const source = await readFile(buildSrcPath('templates', filename), 'utf-8');

  handlebars.registerPartial(name, source);
}

// Loads a template from the filesystem and compiles it to a function.
async function loadTemplate(filename) {
  const source = await readFile(buildSrcPath('templates', filename), 'utf-8');

  return handlebars.compile(source);
}

// Plucks and wraps the first paragraph out of post HTML to form a snippet.
function makeSnippet(rendered) {
  const innerHtml = cheerio.load(rendered)('p')
    .html()
    .slice(0, -1);

  return `<p class="quote">${innerHtml}</p>`;
}

// Renders markdown to an HTML snippet. Also calculates various data which will
// be used by templates.
async function renderMarkdown(post, baseUrl) {
  const render = makeRenderer(baseUrl);
  const digested = frontMatter(post);

  digested.isBlogEntry = true;
  digested.slug = `${makeSlug(digested.attributes.title, { lower: true })}`;
  digested.canonical = `${baseUrl}/blog/${digested.slug}`;
  digested.mastodonHandle = '@qubyte@mastodon.social';
  digested.content = await render(digested.body);
  digested.snippet = makeSnippet(digested.content);
  digested.title = `Qubyte Codes - ${digested.attributes.title}`;
  digested.date = new Date(digested.attributes.datetime);

  return digested;
}

// Loads and renders post source files and their metadata. Note, this renders
// content to HTML, but *not* pages. The HTML created here must be placed within
// a template to form a complete page.
async function loadPostFiles(baseUrl) {
  const filenames = await readDir(buildSrcPath('posts'));
  const filePaths = filenames.map(filename => buildSrcPath('posts', filename));
  const contents = await Promise.all(filePaths.map(path => readFile(path, 'utf-8')));
  const rendered = await Promise.all(contents.map(c => renderMarkdown(c, baseUrl)));

  return rendered;
}

// Creates a public directory and subdirectories.
async function createDirectories() {
  await mkdir(buildPublicPath());
  await Promise.all([
    mkdir(buildPublicPath('blog')),
    mkdir(buildPublicPath('icons')),
    mkdir(buildPublicPath('tags'))
  ]);
}

// Loads and compiles template files into functions.
async function loadTemplates() {
  await Promise.all([
    loadPartial('head.html.handlebars'),
    loadPartial('copyright.html.handlebars'),
    loadPartial('share-tweet.html.handlebars'),
    loadPartial('share-toot.html.handlebars'),
    loadPartial('webmention-form.html.handlebars'),
    loadPartial('comments-tweet.html.handlebars'),
    loadPartial('comments-toot.html.handlebars')
  ]);

  const results = await Promise.all([
    loadTemplate('index.html.handlebars'),
    loadTemplate('tag.html.handlebars'),
    loadTemplate('about.html.handlebars'),
    loadTemplate('blog.html.handlebars'),
    loadTemplate('webmention.html.handlebars'),
    loadTemplate('atom.xml.handlebars'),
    loadTemplate('sitemap.txt.handlebars')
  ]);

  return {
    indexTemplate: results[0],
    tagTemplate: results[1],
    aboutTemplate: results[2],
    blogTemplate: results[3],
    webmentionTemplate: results[4],
    atomTemplate: results[5],
    sitemapTemplate: results[6]
  };
}

// Compiles a list of tags from post metadata.
function collateTags(posts) {
  const tags = {};

  for (const post of posts) {
    for (const tag of post.attributes.tags || []) {
      if (!tags[tag]) {
        tags[tag] = [];
      }

      tags[tag].push(post);
    }
  }

  return tags;
}

// Gets the date of the most recent edit to the post files.
async function getLastPostCommit() {
  const { stdout, stderr } = await exec('git log -1 --format=%ct src/posts');

  if (stderr) {
    throw new Error(`Error from exec: ${stderr}`);
  }

  return new Date(parseInt(stdout.trim(), 10) * 1000);
}

// Copies static files to a fresh public directory.
async function copyFiles() {
  await createDirectories();
  await cpy(buildSrcPath('icons', '*.png'), buildPublicPath('icons'));
  await cpy(['google*', 'keybase.txt', 'index.js', 'sw.js', 'manifest.json'].map(n => buildSrcPath(n)), buildPublicPath());
}

function dateDescending(a, b) {
  return b.date - a.date;
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

// This is where it all kicks off. This function loads posts and templates,
// renders it all to files, and saves them to the public directory.
exports.build = async function build(baseUrl) {
  await copyFiles();

  // Load and compile markdown template files into functions.
  const {
    indexTemplate,
    tagTemplate,
    aboutTemplate,
    blogTemplate,
    webmentionTemplate,
    atomTemplate,
    sitemapTemplate
  } = await loadTemplates();

  // Load markdown posts, render them to HTML content, and sort them.
  const posts = (await loadPostFiles(baseUrl)).sort(dateDescending);

  // Compile CSS to a single file, with a unique filename.
  const cssPath = await generateCss(path.join(__dirname, 'src', 'css', 'entry.css'));

  // Make a list of tags found in posts.
  const tags = collateTags(posts);

  // Determine if this is in development or production.
  const dev = process.env.NODE_ENV === 'development';

  // Render various pages.
  const renderedPosts = renderPosts(posts, blogTemplate, cssPath, dev);
  const indexHtml = indexTemplate({ posts, cssPath, dev, title: 'Qubyte Codes' });
  const aboutHtml = aboutTemplate({ cssPath, dev, title: 'Qubyte Codes - about' });
  const webmentionHtml = webmentionTemplate({ cssPath, dev, title: 'Qubyte Codes - webmention' });

  // Render the atom feed.
  const atomXML = atomTemplate({ posts, updated: await getLastPostCommit() });

  // Render the site map.
  const sitemapTxt = sitemapTemplate({ posts });

  // Write the rendered templates to the public directory.
  await Promise.all([
    writeFile(buildPublicPath('index.html'), indexHtml),
    writeFile(buildPublicPath('about.html'), aboutHtml),
    writeFile(buildPublicPath('webmention.html'), webmentionHtml),
    ...renderedPosts.map(({ html, filename }) => writeFile(buildPublicPath('blog', filename), html)),
    ...Object.entries(tags).map(([tag, posts]) => {
      const tagHtml = tagTemplate({ posts, tag, cssPath, dev, title: `Qubyte Codes - Posts tagged as ${tag}` });

      return writeFile(buildPublicPath('tags', `${tag}.html`), tagHtml);
    }),
    writeFile(buildPublicPath('atom.xml'), atomXML),
    writeFile(buildPublicPath('sitemap.txt'), sitemapTxt)
  ]);
};

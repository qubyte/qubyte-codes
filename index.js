'use strict';

const frontMatter = require('front-matter');
const path = require('path');
const crypto = require('crypto');
const { loadPartial, loadTemplate } = require('./lib/templates');
const buildPaths = require('./lib/build-paths');
const makeSlug = require('slug');
const makeRenderer = require('./lib/render');
const { promises: { mkdir, readdir, readFile, writeFile } } = require('fs');
const cpy = require('cpy');
const cheerio = require('cheerio');
const postcss = require('postcss');
const postcssImport = require('postcss-import');
const postCssPresetEnv = require('postcss-preset-env');
const postCssCalc = require('postcss-calc');
const customProperties = require('postcss-custom-properties');
const cssnano = require('cssnano');
const exec = require('util').promisify(require('child_process').exec);

// Compiles and calculates a unique filename for CSS.
async function generateCss(cssEntryPath) {
  const { css } = await postcss([
    postcssImport({ path: path.dirname(cssEntryPath) }),
    postCssPresetEnv(),
    customProperties({ preserve: false }),
    postCssCalc(),
    cssnano({ preset: 'default' })
  ]).process(await readFile(cssEntryPath, 'utf8'), { from: cssEntryPath });

  const hash = crypto
    .createHash('md5')
    .update(css)
    .digest('hex');

  const cssPath = buildPaths.public(`main-${hash}.css`);

  await writeFile(cssPath, css);

  return `/main-${hash}.css`;
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
async function renderMarkdown(post, baseUrl, renderer) {
  const digested = frontMatter(post);

  digested.isBlogEntry = true;
  digested.slug = `${makeSlug(digested.attributes.title, { lower: true })}`;
  digested.canonical = `${baseUrl}/blog/${digested.slug}`;
  digested.mastodonHandle = '@qubyte@mastodon.social';
  digested.content = await renderer(digested.body);
  digested.snippet = makeSnippet(digested.content);
  digested.title = `Qubyte Codes - ${digested.attributes.title}`;
  digested.date = new Date(digested.attributes.datetime);

  return digested;
}

// Loads and renders post source files and their metadata. Note, this renders
// content to HTML, but *not* pages. The HTML created here must be placed within
// a template to form a complete page.
async function loadPostFiles(baseUrl, renderer) {
  const filenames = await readdir(buildPaths.src('posts'));
  const filePaths = filenames.map(filename => buildPaths.src('posts', filename));
  const contents = await Promise.all(filePaths.map(path => readFile(path, 'utf-8')));
  const rendered = await Promise.all(contents.map(c => renderMarkdown(c, baseUrl, renderer)));

  return rendered;
}

// Creates a public directory and subdirectories.
async function createDirectories() {
  await mkdir(buildPaths.public());
  await Promise.all([
    mkdir(buildPaths.public('blog')),
    mkdir(buildPaths.public('icons')),
    mkdir(buildPaths.public('tags')),
    mkdir(buildPaths.public('img'))
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
async function copyFiles(compileCss) {
  await createDirectories();
  await cpy(buildPaths.src('icons', '*.png'), buildPaths.public('icons'));
  await cpy(buildPaths.src('img', '*'), buildPaths.public('img'));
  await cpy(buildPaths.src('scripts', '*.js'), buildPaths.public('scripts'));
  await cpy(['google*', 'keybase.txt', 'index.js', 'sw.js', 'manifest.json'].map(n => buildPaths.src(n)), buildPaths.public());

  if (!compileCss) {
    await cpy(buildPaths.src('css', '*.css'), buildPaths.public('css'));
  }
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
exports.build = async function build(baseUrl, dev, compileCss) {
  await copyFiles(compileCss);

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

  const renderer = makeRenderer(baseUrl);

  // Load markdown posts, render them to HTML content, and sort them by date descending.
  const posts = (await loadPostFiles(baseUrl, renderer)).sort((a, b) => b.date - a.date);

  // Compile CSS to a single file, with a unique filename.
  const cssPath = compileCss ? await generateCss(path.join(__dirname, 'src', 'css', 'entry.css')) : '/css/entry.css';

  // Make a list of tags found in posts.
  const tags = collateTags(posts);

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
    writeFile(buildPaths.public('index.html'), indexHtml),
    writeFile(buildPaths.public('about.html'), aboutHtml),
    writeFile(buildPaths.public('webmention.html'), webmentionHtml),
    ...renderedPosts.map(({ html, filename }) => writeFile(buildPaths.public('blog', filename), html)),
    ...Object.entries(tags).map(([tag, posts]) => {
      const tagHtml = tagTemplate({ posts, tag, cssPath, dev, title: `Qubyte Codes - Posts tagged as ${tag}` });

      return writeFile(buildPaths.public('tags', `${tag}.html`), tagHtml);
    }),
    writeFile(buildPaths.public('atom.xml'), atomXML),
    writeFile(buildPaths.public('sitemap.txt'), sitemapTxt)
  ]);
};

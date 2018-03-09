'use strict';

const CleanCss = require('clean-css');
const frontMatter = require('front-matter');
const path = require('path');
const crypto = require('crypto');
const handlebars = require('handlebars');
const makeSlug = require('slug');
const remark = require('remark');
const makeRenderer = require('./lib/render');
const fs = require('fs');
const { promisify } = require('util');
const cpy = require('cpy');
const exec = promisify(require('child_process').exec);

const mkdir = promisify(fs.mkdir);
const readDir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

function dateToIso(date) {
  return date.toISOString().replace(/\.[0-9]{3}Z/, 'Z');
}

handlebars.registerHelper('humanDate', datetime => {
  return new Date(datetime).toDateString();
});

handlebars.registerHelper('isoDate', datetime => {
  return dateToIso(new Date(datetime));
});

function buildSrcPath(...parts) {
  return path.join(__dirname, 'src', ...parts);
}

function buildPublicPath(...parts) {
  return path.join(__dirname, 'public', ...parts);
}

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

async function loadPartial(filename) {
  const [name] = filename.split('.');
  const source = await readFile(buildSrcPath('templates', filename), 'utf-8');

  handlebars.registerPartial(name, source);
}

async function loadTemplate(filename) {
  const source = await readFile(buildSrcPath('templates', filename), 'utf-8');

  return handlebars.compile(source);
}

function makeSnippet(body) {
  const ast = remark().parse(body);

  for (const child of ast.children) {
    if (child.type === 'paragraph') {
      return remark()
        .stringify(child)
        .slice(0, -1);
    }
  }

  return '';
}

async function renderMarkdown(post, baseUrl) {
  const render = makeRenderer(baseUrl);
  const digested = frontMatter(post);
  const { title, tags = [] } = digested.attributes;
  const slug = `${makeSlug(title, { lower: true })}`;
  const canonical = `${baseUrl}/blog/${slug}`;

  digested.attributes.slug = slug;
  digested.attributes.filename = `${slug}.html`;
  digested.attributes.snippet = await render(makeSnippet(digested.body));
  digested.attributes.tweetText = encodeURIComponent(`Qubyte Codes - ${title}`);
  digested.attributes.tootText = encodeURIComponent(
    `Qubyte Codes - ${title} via @qubyte@mastodon.social ${tags.map(t => `#${t}`).join(' ')} ${canonical}`
  );
  digested.attributes.canonical = canonical;
  digested.content = await render(digested.body);
  digested.isBlogEntry = true;
  digested.title = `Qubyte Codes - ${title}`;
  digested.date = new Date(digested.attributes.datetime);
  return digested;
}

async function loadPostFiles(baseUrl) {
  const filenames = await readDir(buildSrcPath('posts'));
  const filePaths = filenames.map(filename => buildSrcPath('posts', filename));
  const contents = await Promise.all(filePaths.map(path => readFile(path, 'utf-8')));
  const rendered = await Promise.all(contents.map(c => renderMarkdown(c, baseUrl)));

  return rendered;
}

async function createDirectories() {
  await mkdir(buildPublicPath());
  await Promise.all([
    mkdir(buildPublicPath('blog')),
    mkdir(buildPublicPath('icons')),
    mkdir(buildPublicPath('tags'))
  ]);
}

async function loadTemplates() {
  await Promise.all([
    loadPartial('head.html.handlebars'),
    loadPartial('copyright.html.handlebars')
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

async function getLastPostCommit() {
  const { stdout, stderr } = await exec('git log -1 --format=%ct src/posts');

  if (stderr) {
    throw new Error(`Error from exec: ${stderr}`);
  }

  return new Date(parseInt(stdout.trim(), 10) * 1000);
}

async function copyFiles() {
  await createDirectories();
  await cpy(buildSrcPath('icons', '*.png'), buildPublicPath('icons'));
  await cpy(['google*', 'keybase.txt', 'index.js', 'sw.js', 'manifest.json'].map(n => buildSrcPath(n)), buildPublicPath());
}

function dateDescending(a, b) {
  return b.date - a.date;
}

function renderPosts(posts, blogTemplate, cssPath, dev) {
  const rendered = [];

  for (let i = 0; i < posts.length; i++) {
    const previous = posts[i - 1];
    const post = posts[i];
    const next = posts[i + 1];
    const renderObject = { ...post, cssPath, dev };

    if (previous) {
      renderObject.prevLink = `/blog/${previous.attributes.slug}`;
    }

    if (next) {
      renderObject.nextLink = `/blog/${next.attributes.slug}`;
    }

    rendered.push({
      html: blogTemplate(renderObject),
      filename: post.attributes.filename
    });
  }

  return rendered;
}

exports.build = async function build(baseUrl) {
  await copyFiles();

  const {
    indexTemplate,
    tagTemplate,
    aboutTemplate,
    blogTemplate,
    webmentionTemplate,
    atomTemplate,
    sitemapTemplate
  } = await loadTemplates();

  const posts = (await loadPostFiles(baseUrl)).sort(dateDescending);
  const cssPath = await generateCss(path.join(__dirname, 'src', 'css', 'entry.css'));
  const tags = collateTags(posts);
  const dev = process.env.NODE_ENV === 'development';

  const renderedPosts = renderPosts(posts, blogTemplate, cssPath, dev);

  const indexHtml = indexTemplate({ posts, cssPath, dev, title: 'Qubyte Codes' });
  const aboutHtml = aboutTemplate({ cssPath, dev, title: 'Qubyte Codes - about' });
  const webmentionHtml = webmentionTemplate({ cssPath, dev, title: 'Qubyte Codes - webmention' });
  const atomXML = atomTemplate({ posts, updated: await getLastPostCommit() });
  const sitemapTxt = sitemapTemplate({ posts });

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

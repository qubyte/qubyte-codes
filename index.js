'use strict';

/* eslint max-statements: off */

const path = require('path');
const loadTemplates = require('./lib/templates');
const generateCss = require('./lib/generate-css');
const loadPostFiles = require('./lib/load-post-files');
const loadNoteFiles = require('./lib/load-note-files');
const loadLinkFiles = require('./lib/load-link-files');
const loadLikeFiles = require('./lib/load-like-files');
const loadReplyFiles = require('./lib/load-reply-files');
const appendPostContent = require('./lib/append-post-content');
const collateTags = require('./lib/collate-tags');
const getLastCommitTime = require('./lib/get-last-commit-time');
const fs = require('fs').promises;
const cpy = require('cpy');
const publications = require('./src/publications');

// Copies static files and directories to a fresh public directory.
async function copyFiles(source, target, content) {
  function copy(directory, subDirectory) {
    return cpy(path.join(directory, subDirectory, '*'), path.join(target, subDirectory));
  }

  await fs.mkdir(target);

  await Promise.all([
    fs.mkdir(path.join(target, 'blog')),
    fs.mkdir(path.join(target, 'notes')),
    fs.mkdir(path.join(target, 'links')),
    fs.mkdir(path.join(target, 'likes')),
    fs.mkdir(path.join(target, 'replies')),
    fs.mkdir(path.join(target, 'tags')),
    fs.mkdir(path.join(target, 'images')),
    copy(source, 'icons'),
    copy(source, 'fonts'),
    copy(source, 'img'),
    copy(content, 'scripts'),
    copy(content, 'papers'),
    copy(content, 'images'),
    cpy(
      ['google*', 'keybase.txt', 'robots.txt', 'index.js', 'sw.js', 'manifest.json'].map(n => path.join(source, n)),
      target
    )
  ]);
}

async function writePublicFile(content, ...pathParts) {
  await fs.writeFile(path.join(...pathParts), content);
}

// This is where it all kicks off. This function loads posts and templates,
// renders it all to files, and saves them to the public directory.

exports.build = async function build({ baseUrl, baseTitle, dev, syndications }) {
  const source = path.join(__dirname, 'src');
  const target = path.join(__dirname, 'public');
  const content = path.join(__dirname, 'content');

  const gettingLastContentCommitTime = getLastCommitTime(path.join(content));

  const [templates, posts, notes, links, likes, replies, cssPath] = await Promise.all([
    // Load and compile markdown template files into functions.
    loadTemplates(path.join(source, 'templates'), { baseTitle }),
    // Load markdown posts, render them to HTML content, and sort them by date descending.
    loadPostFiles(path.join(content, 'posts'))
      .then(posts => Promise.all(posts.map(p => appendPostContent(p, baseUrl)))),
    // Load short form notes, and reposts (links), render them to HTML content, and sort them by date descending.
    loadNoteFiles(path.join(content, 'notes'), syndications),
    loadLinkFiles(path.join(content, 'links'), syndications),
    loadLikeFiles(path.join(content, 'likes')),
    loadReplyFiles(path.join(content, 'replies')),
    // After creating the target directory structure, compile CSS to a single file, with a unique filename.
    copyFiles(source, target, content)
      .then(() => generateCss(path.join(source, 'css'), target, 'entry.css', 'default'))
  ]);

  // Make a list of tags found in posts.
  const tags = collateTags(posts, cssPath, dev, templates.tag);

  function renderResources(resources, template) {
    return resources.map(resource => ({ html: template({ ...resource, cssPath, dev }), filename: resource.filename }));
  }

  // Render various pages.
  const renderedBlogs = renderResources(posts, templates.blog);
  const renderedNotes = renderResources(notes, templates.note);
  const renderedLinks = renderResources(links, templates.link);
  const renderedLikes = renderResources(likes, templates.like);
  const renderedReplies = renderResources(replies, templates.reply);
  const blogsHtml = templates.blogs({ posts, cssPath, dev, localUrl: '/blog', title: 'Archive' });
  const notesHtml = templates.notes({ notes, cssPath, dev, localUrl: '/notes', title: 'Notes' });
  const linksHtml = templates.links({ links, cssPath, dev, localUrl: '/links', title: 'Links' });
  const likesHtml = templates.likes({ likes, cssPath, dev, localUrl: '/likes', title: 'Likes' });
  const repliesHtml = templates.replies({ replies, cssPath, dev, localUrl: '/replies', title: 'Replies' });
  const aboutHtml = templates.about({ cssPath, dev, localUrl: '/', title: 'About' });
  const publicationsHtml = templates.publications({ cssPath, dev, localUrl: '/publications', publications, title: 'Publications' });
  const fourOhFourHtml = templates[404]({ cssPath, dev, localUrl: '/404', title: 'Not Found' });
  const webmentionHtml = templates.webmention({ cssPath, dev, localUrl: '/webmention', title: 'Webmention' });

  // Render the site map.
  const sitemapTxt = templates.sitemap({ posts, tags, notes, links, likes, replies });
  const everything = [...posts, ...notes, ...links, ...likes, ...replies].sort((a, b) => b.timestamp - a.timestamp);

  // Write the rendered templates to the public directory.
  await Promise.all([
    writePublicFile(aboutHtml, target, 'index.html'),
    writePublicFile(blogsHtml, target, 'blog', 'index.html'),
    writePublicFile(notesHtml, target, 'notes', 'index.html'),
    writePublicFile(linksHtml, target, 'links', 'index.html'),
    writePublicFile(likesHtml, target, 'likes', 'index.html'),
    writePublicFile(repliesHtml, target, 'replies', 'index.html'),
    writePublicFile(publicationsHtml, target, 'publications.html'),
    writePublicFile(webmentionHtml, target, 'webmention.html'),
    writePublicFile(fourOhFourHtml, target, '404.html'),
    ...renderedBlogs.map(post => writePublicFile(post.html, target, 'blog', post.filename)),
    ...renderedNotes.map(note => writePublicFile(note.html, target, 'notes', note.filename)),
    ...renderedLinks.map(link => writePublicFile(link.html, target, 'links', link.filename)),
    ...renderedLikes.map(like => writePublicFile(like.html, target, 'likes', like.filename)),
    ...renderedReplies.map(reply => writePublicFile(reply.html, target, 'replies', reply.filename)),
    ...tags.map(tag => writePublicFile(tag.rendered, target, 'tags', tag.filename)),
    writePublicFile(sitemapTxt, target, 'sitemap.txt'),
    gettingLastContentCommitTime
      .then(updated => writePublicFile(templates.atom({ items: everything, updated }), target, 'atom.xml'))
  ]);
};

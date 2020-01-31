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
const collateTags = require('./lib/collate-tags');
const getLastCommitTime = require('./lib/get-last-commit-time');
const ExecutionGraph = require('./lib/execution-graph');
const fs = require('fs').promises;
const cpy = require('cpy');
const publications = require('./src/publications');

async function writePublicFile(content, ...pathParts) {
  await fs.writeFile(path.join(...pathParts), content);
}

// This is where it all kicks off. This function loads posts and templates,
// renders it all to files, and saves them to the public directory.

exports.build = function build({ baseUrl, baseTitle, dev, syndications }) {
  const source = path.join(__dirname, 'src');
  const target = path.join(__dirname, 'public');
  const content = path.join(__dirname, 'content');

  const graph = new ExecutionGraph();

  async function makeDirectory(...pathParts) {
    const directory = path.join(target, ...pathParts);

    await fs.rmdir(directory, { recursive: true });
    await fs.mkdir(directory);
  }

  function renderResources(resources, template, cssPath) {
    return resources.map(resource => ({ html: template({ ...resource, cssPath, dev }), filename: resource.filename }));
  }

  return graph.addNodes({
    commitTime: {
      action() {
        return getLastCommitTime(content);
      }
    },
    templates: {
      action() {
        return loadTemplates(path.join(source, 'templates'), { baseTitle });
      }
    },
    postFiles: {
      action() {
        return loadPostFiles(path.join(content, 'posts'), baseUrl);
      }
    },
    noteFiles: {
      action() {
        return loadNoteFiles(path.join(content, 'notes'), syndications);
      }
    },
    linkFiles: {
      action() {
        return loadLinkFiles(path.join(content, 'links'), syndications);
      }
    },
    likeFiles: {
      action() {
        return loadLikeFiles(path.join(content, 'likes'));
      }
    },
    replyFiles: {
      action() {
        return loadReplyFiles(path.join(content, 'replies'));
      }
    },
    publicDirectory: {
      action() {
        return makeDirectory();
      }
    },
    blogDirectory: {
      dependencies: ['publicDirectory'],
      action() {
        return makeDirectory('blog');
      }
    },
    notesDirectory: {
      dependencies: ['publicDirectory'],
      action() {
        return makeDirectory('notes');
      }
    },
    linksDirectory: {
      dependencies: ['publicDirectory'],
      action() {
        return makeDirectory('links');
      }
    },
    likesDirectory: {
      dependencies: ['publicDirectory'],
      action() {
        return makeDirectory('likes');
      }
    },
    repliesDirectory: {
      dependencies: ['publicDirectory'],
      action() {
        return makeDirectory('replies');
      }
    },
    tagsDirectory: {
      dependencies: ['publicDirectory'],
      action() {
        return makeDirectory('tags');
      }
    },
    staticFiles: {
      dependencies: ['publicDirectory'],
      action() {
        function copy(directory, subDirectory) {
          return cpy(path.join(directory, subDirectory, '*'), path.join(target, subDirectory));
        }

        return Promise.all([
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
    },
    css: {
      dependencies: ['publicDirectory'],
      action() {
        return generateCss(path.join(source, 'css'), target, 'entry.css', 'default');
      }
    },
    collatedTags: {
      dependencies: ['css', 'templates', 'postFiles'],
      action({ postFiles, css, templates }) {
        return collateTags(postFiles, css, dev, templates.tag);
      }
    },
    renderedPosts: {
      dependencies: ['css', 'templates', 'postFiles'],
      action({ postFiles, templates, css }) {
        return renderResources(postFiles, templates.blog, css);
      }
    },
    renderedNotes: {
      dependencies: ['css', 'templates', 'noteFiles'],
      action({ noteFiles, templates, css }) {
        return renderResources(noteFiles, templates.note, css);
      }
    },
    renderedLinks: {
      dependencies: ['css', 'templates', 'linkFiles'],
      action({ linkFiles, templates, css }) {
        return renderResources(linkFiles, templates.link, css);
      }
    },
    renderedLikes: {
      dependencies: ['css', 'templates', 'likeFiles'],
      action({ likeFiles, templates, css }) {
        return renderResources(likeFiles, templates.like, css);
      }
    },
    renderedReplies: {
      dependencies: ['css', 'templates', 'replyFiles'],
      action({ replyFiles, templates, css }) {
        return renderResources(replyFiles, templates.replies, css);
      }
    },
    renderedBlogIndex: {
      dependencies: ['css', 'templates', 'postFiles'],
      action({ postFiles: posts, templates, css: cssPath }) {
        return templates.blogs({ posts, cssPath, dev, localUrl: '/blog', title: 'Archive' });
      }
    },
    renderedNotesIndex: {
      dependencies: ['css', 'templates', 'noteFiles'],
      action({ noteFiles: notes, templates, css: cssPath }) {
        return templates.notes({ notes, cssPath, dev, localUrl: '/notes', title: 'Notes' });
      }
    },
    renderedLinksIndex: {
      dependencies: ['css', 'templates', 'linkFiles'],
      action({ linkFiles: links, templates, css: cssPath }) {
        return templates.links({ links, cssPath, dev, localUrl: '/links', title: 'Links' });
      }
    },
    renderedLikesIndex: {
      dependencies: ['css', 'templates', 'likeFiles'],
      action({ likeFiles: likes, templates, css: cssPath }) {
        return templates.likes({ likes, cssPath, dev, localUrl: '/likes', title: 'Likes' });
      }
    },
    renderedRepliesIndex: {
      dependencies: ['css', 'templates', 'replyFiles'],
      action({ replyFiles: replies, templates, css: cssPath }) {
        return templates.replies({ replies, cssPath, dev, localUrl: '/replies', title: 'Replies' });
      }
    },
    renderedAbout: {
      dependencies: ['css', 'templates'],
      action({ templates, css: cssPath }) {
        return templates.about({ cssPath, dev, localUrl: '/', title: 'About' });
      }
    },
    renderedPublications: {
      dependencies: ['css', 'templates'],
      action({ templates, css: cssPath }) {
        return templates.publications({ cssPath, dev, localUrl: '/publications', publications, title: 'Publications' });
      }
    },
    renderedFourOhFour: {
      dependencies: ['css', 'templates'],
      action({ templates, css: cssPath }) {
        return templates[404]({ cssPath, dev, localUrl: '/404', title: 'Not Found' });
      }
    },
    renderedWebmentionConfirmation: {
      dependencies: ['css', 'templates'],
      action({ templates, css: cssPath }) {
        return templates.webmention({ cssPath, dev, localUrl: '/webmention', title: 'Webmention' });
      }
    },
    renderedSitemap: {
      dependencies: ['templates', 'collatedTags', 'postFiles', 'noteFiles', 'linkFiles', 'likeFiles', 'replyFiles'],
      action({
        templates,
        collatedTags: tags,
        postFiles: posts,
        noteFiles: notes,
        linkFiles: links,
        likeFiles: likes,
        replyFiles: replies
      }) {
        return templates.sitemap({ posts, tags, notes, links, likes, replies });
      }
    },
    renderedAtomFeed: {
      dependencies: ['templates', 'commitTime', 'postFiles', 'noteFiles', 'linkFiles', 'likeFiles', 'replyFiles'],
      action({ templates, commitTime, postFiles, noteFiles, linkFiles, likeFiles, replyFiles }) {
        const items = [...postFiles, ...noteFiles, ...linkFiles, ...likeFiles, ...replyFiles]
          .sort((a, b) => b.timestamp - a.timestamp);

        return templates.atom({ items, updated: commitTime });
      }
    },
    writtenIndex: {
      dependencies: ['renderedAbout'],
      action({ renderedAbout }) {
        writePublicFile(renderedAbout, target, 'index.html');
      }
    },
    writtenBlogIndex: {
      dependencies: ['renderedBlogIndex'],
      action({ renderedBlogIndex }) {
        return writePublicFile(renderedBlogIndex, target, 'blog', 'index.html');
      }
    },
    writtenNotesIndex: {
      dependencies: ['renderedNotesIndex'],
      action({ renderedNotesIndex }) {
        return writePublicFile(renderedNotesIndex, target, 'notes', 'index.html');
      }
    },
    writtenLinksIndex: {
      dependencies: ['renderedLinksIndex'],
      action({ renderedLinksIndex }) {
        return writePublicFile(renderedLinksIndex, target, 'links', 'index.html');
      }
    },
    writtenLikesIndex: {
      dependencies: ['renderedLikesIndex'],
      action({ renderedLikesIndex }) {
        return writePublicFile(renderedLikesIndex, target, 'likes', 'index.html');
      }
    },
    writtenRepliesIndex: {
      dependencies: ['renderedRepliesIndex'],
      action({ renderedRepliesIndex }) {
        return writePublicFile(renderedRepliesIndex, target, 'replies', 'index.html');
      }
    },
    writtenPublications: {
      dependencies: ['renderedPublications'],
      action({ renderedPublications }) {
        return writePublicFile(renderedPublications, target, 'publications.html');
      }
    },
    writtenWebmentionConfirmation: {
      dependencies: ['renderedWebmentionConfirmation'],
      action({ renderedWebmentionConfirmation }) {
        return writePublicFile(renderedWebmentionConfirmation, target, 'webmention.html');
      }
    },
    writtenFourOhFour: {
      dependencies: ['renderedFourOhFour'],
      action({ renderedFourOhFour }) {
        return writePublicFile(renderedFourOhFour, target, '404.html');
      }
    },
    writtenSitemap: {
      dependencies: ['renderedSitemap'],
      action({ renderedSitemap }) {
        return writePublicFile(renderedSitemap, target, 'sitemap.txt');
      }
    },
    writtenAtomFeed: {
      dependencies: ['renderedAtomFeed'],
      action({ renderedAtomFeed }) {
        return writePublicFile(renderedAtomFeed, target, 'atom.xml');
      }
    },
    writtenPosts: {
      dependencies: ['renderedPosts'],
      action({ renderedPosts }) {
        return renderedPosts.map(post => writePublicFile(post.html, target, 'blog', post.filename));
      }
    },
    writtenNotes: {
      dependencies: ['renderedNotes'],
      action({ renderedNotes }) {
        return renderedNotes.map(note => writePublicFile(note.html, target, 'notes', note.filename));
      }
    },
    writtenLinks: {
      dependencies: ['renderedLinks'],
      action({ renderedLinks }) {
        return renderedLinks.map(note => writePublicFile(note.html, target, 'links', note.filename));
      }
    },
    writtenLikes: {
      dependencies: ['renderedLikes'],
      action({ renderedLikes }) {
        return renderedLikes.map(note => writePublicFile(note.html, target, 'likes', note.filename));
      }
    },
    writtenReplies: {
      dependencies: ['renderedReplies'],
      action({ renderedReplies }) {
        return renderedReplies.map(note => writePublicFile(note.html, target, 'replies', note.filename));
      }
    },
    writtenTags: {
      dependencies: ['collatedTags'],
      action({ collatedTags }) {
        return collatedTags.map(note => writePublicFile(note.html, target, 'tags', note.filename));
      }
    }
  });
};

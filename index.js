'use strict';

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

function renderResources({ resources, template, cssPath, baseUrl, dev }) {
  return resources.map(resource => ({
    html: template({ ...resource, cssPath, baseUrl, dev }),
    filename: resource.filename
  }));
}

// This is where it all kicks off. This function loads posts and templates,
// renders it all to files, and saves them to the public directory.

exports.build = async function build({ baseUrl, baseTitle, dev, syndications }) {
  const graph = new ExecutionGraph();

  await graph.addNodes({
    paths: {
      action() {
        const source = path.join(__dirname, 'src');
        const target = path.join(__dirname, 'public');
        const content = path.join(__dirname, 'content');

        async function makeDirectory(...pathParts) {
          const directory = path.join(target, ...pathParts);

          await fs.rmdir(directory, { recursive: true });
          await fs.mkdir(directory);
        }

        return { source, target, content, makeDirectory };
      }
    },
    commitTime: {
      dependencies: ['paths'],
      action({ paths: { content } }) {
        return getLastCommitTime(content);
      }
    },
    templates: {
      dependencies: ['paths'],
      action({ paths: { source } }) {
        return loadTemplates(path.join(source, 'templates'), { baseTitle });
      }
    },
    postFiles: {
      dependencies: ['paths'],
      action({ paths: { content } }) {
        return loadPostFiles(path.join(content, 'posts'), baseUrl);
      }
    },
    noteFiles: {
      dependencies: ['paths'],
      action({ paths: { content } }) {
        return loadNoteFiles(path.join(content, 'notes'), syndications);
      }
    },
    linkFiles: {
      dependencies: ['paths'],
      action({ paths: { content } }) {
        return loadLinkFiles(path.join(content, 'links'), syndications);
      }
    },
    likeFiles: {
      dependencies: ['paths'],
      action({ paths: { content } }) {
        return loadLikeFiles(path.join(content, 'likes'));
      }
    },
    replyFiles: {
      dependencies: ['paths'],
      action({ paths: { content } }) {
        return loadReplyFiles(path.join(content, 'replies'));
      }
    },
    publicDirectory: {
      dependencies: ['paths'],
      action({ paths: { makeDirectory } }) {
        return makeDirectory();
      }
    },
    blogDirectory: {
      dependencies: ['paths', 'publicDirectory'],
      action({ paths: { makeDirectory } }) {
        return makeDirectory('blog');
      }
    },
    notesDirectory: {
      dependencies: ['paths', 'publicDirectory'],
      action({ paths: { makeDirectory } }) {
        return makeDirectory('notes');
      }
    },
    linksDirectory: {
      dependencies: ['paths', 'publicDirectory'],
      action({ paths: { makeDirectory } }) {
        return makeDirectory('links');
      }
    },
    likesDirectory: {
      dependencies: ['paths', 'publicDirectory'],
      action({ paths: { makeDirectory } }) {
        return makeDirectory('likes');
      }
    },
    repliesDirectory: {
      dependencies: ['paths', 'publicDirectory'],
      action({ paths: { makeDirectory } }) {
        return makeDirectory('replies');
      }
    },
    tagsDirectory: {
      dependencies: ['paths', 'publicDirectory'],
      action({ paths: { makeDirectory } }) {
        return makeDirectory('tags');
      }
    },
    staticFiles: {
      dependencies: ['paths', 'publicDirectory'],
      action({ paths: { source, target, content } }) {
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
      dependencies: ['paths', 'publicDirectory'],
      action({ paths: { source, target } }) {
        return generateCss(path.join(source, 'css'), target, 'entry.css', 'default');
      }
    },
    collatedTags: {
      dependencies: ['css', 'templates', 'postFiles'],
      action({ postFiles: posts, css: cssPath, templates: { tag: template } }) {
        return collateTags({ posts, cssPath, baseUrl, dev, template });
      }
    },
    renderedPosts: {
      dependencies: ['css', 'templates', 'postFiles'],
      action({ postFiles: resources, templates: { blog: template }, css: cssPath }) {
        return renderResources({ resources, template, cssPath, baseUrl, dev });
      }
    },
    renderedNotes: {
      dependencies: ['css', 'templates', 'noteFiles'],
      action({ noteFiles: resources, templates: { note: template }, css: cssPath }) {
        return renderResources({ resources, template, cssPath, baseUrl, dev });
      }
    },
    renderedLinks: {
      dependencies: ['css', 'templates', 'linkFiles'],
      action({ linkFiles: resources, templates: { link: template }, css: cssPath }) {
        return renderResources({ resources, template, cssPath, baseUrl, dev });
      }
    },
    renderedLikes: {
      dependencies: ['css', 'templates', 'likeFiles'],
      action({ likeFiles: resources, templates: { like: template }, css: cssPath }) {
        return renderResources({ resources, template, cssPath, baseUrl, dev });
      }
    },
    renderedReplies: {
      dependencies: ['css', 'templates', 'replyFiles'],
      action({ replyFiles: resources, templates: { replies: template }, css: cssPath }) {
        return renderResources({ resources, template, cssPath, baseUrl, dev });
      }
    },
    renderedBlogIndex: {
      dependencies: ['css', 'templates', 'postFiles'],
      action({ postFiles: posts, templates, css: cssPath }) {
        return templates.blogs({ posts, cssPath, dev, baseUrl, localUrl: '/blog', title: 'Archive' });
      }
    },
    renderedNotesIndex: {
      dependencies: ['css', 'templates', 'noteFiles'],
      action({ noteFiles: notes, templates, css: cssPath }) {
        return templates.notes({ notes, cssPath, dev, baseUrl, localUrl: '/notes', title: 'Notes' });
      }
    },
    renderedLinksIndex: {
      dependencies: ['css', 'templates', 'linkFiles'],
      action({ linkFiles: links, templates, css: cssPath }) {
        return templates.links({ links, cssPath, dev, baseUrl, localUrl: '/links', title: 'Links' });
      }
    },
    renderedLikesIndex: {
      dependencies: ['css', 'templates', 'likeFiles'],
      action({ likeFiles: likes, templates, css: cssPath }) {
        return templates.likes({ likes, cssPath, dev, baseUrl, localUrl: '/likes', title: 'Likes' });
      }
    },
    renderedRepliesIndex: {
      dependencies: ['css', 'templates', 'replyFiles'],
      action({ replyFiles: replies, templates, css: cssPath }) {
        return templates.replies({ replies, cssPath, dev, baseUrl, localUrl: '/replies', title: 'Replies' });
      }
    },
    renderedAbout: {
      dependencies: ['css', 'templates'],
      action({ templates, css: cssPath }) {
        return templates.about({ cssPath, dev, baseUrl, localUrl: '/', title: 'About' });
      }
    },
    renderedPublications: {
      dependencies: ['css', 'templates'],
      action({ templates, css: cssPath }) {
        return templates.publications({ cssPath, dev, baseUrl, localUrl: '/publications', publications, title: 'Publications' });
      }
    },
    renderedFourOhFour: {
      dependencies: ['css', 'templates'],
      action({ templates, css: cssPath }) {
        return templates[404]({ cssPath, dev, baseUrl, localUrl: '/404', title: 'Not Found' });
      }
    },
    renderedWebmentionConfirmation: {
      dependencies: ['css', 'templates'],
      action({ templates, css: cssPath }) {
        return templates.webmention({ cssPath, dev, baseUrl, localUrl: '/webmention', title: 'Webmention' });
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
        return templates.sitemap({ posts, tags, notes, links, likes, replies, baseUrl });
      }
    },
    renderedAtomFeed: {
      dependencies: ['templates', 'commitTime', 'postFiles', 'noteFiles', 'linkFiles', 'likeFiles', 'replyFiles'],
      action({ templates, commitTime, postFiles, noteFiles, linkFiles, likeFiles, replyFiles }) {
        const items = [...postFiles, ...noteFiles, ...linkFiles, ...likeFiles, ...replyFiles]
          .sort((a, b) => b.timestamp - a.timestamp);

        return templates.atom({ items, baseUrl, updated: commitTime });
      }
    },
    writtenIndex: {
      dependencies: ['paths', 'renderedAbout'],
      action({ paths: { target }, renderedAbout }) {
        writePublicFile(renderedAbout, target, 'index.html');
      }
    },
    writtenBlogIndex: {
      dependencies: ['paths', 'renderedBlogIndex'],
      action({ paths: { target }, renderedBlogIndex }) {
        return writePublicFile(renderedBlogIndex, target, 'blog', 'index.html');
      }
    },
    writtenNotesIndex: {
      dependencies: ['paths', 'renderedNotesIndex'],
      action({ paths: { target }, renderedNotesIndex }) {
        return writePublicFile(renderedNotesIndex, target, 'notes', 'index.html');
      }
    },
    writtenLinksIndex: {
      dependencies: ['paths', 'renderedLinksIndex'],
      action({ paths: { target }, renderedLinksIndex }) {
        return writePublicFile(renderedLinksIndex, target, 'links', 'index.html');
      }
    },
    writtenLikesIndex: {
      dependencies: ['paths', 'renderedLikesIndex'],
      action({ paths: { target }, renderedLikesIndex }) {
        return writePublicFile(renderedLikesIndex, target, 'likes', 'index.html');
      }
    },
    writtenRepliesIndex: {
      dependencies: ['paths', 'renderedRepliesIndex'],
      action({ paths: { target }, renderedRepliesIndex }) {
        return writePublicFile(renderedRepliesIndex, target, 'replies', 'index.html');
      }
    },
    writtenPublications: {
      dependencies: ['paths', 'renderedPublications'],
      action({ paths: { target }, renderedPublications }) {
        return writePublicFile(renderedPublications, target, 'publications.html');
      }
    },
    writtenWebmentionConfirmation: {
      dependencies: ['paths', 'renderedWebmentionConfirmation'],
      action({ paths: { target }, renderedWebmentionConfirmation }) {
        return writePublicFile(renderedWebmentionConfirmation, target, 'webmention.html');
      }
    },
    writtenFourOhFour: {
      dependencies: ['paths', 'renderedFourOhFour'],
      action({ paths: { target }, renderedFourOhFour }) {
        return writePublicFile(renderedFourOhFour, target, '404.html');
      }
    },
    writtenSitemap: {
      dependencies: ['paths', 'renderedSitemap'],
      action({ paths: { target }, renderedSitemap }) {
        return writePublicFile(renderedSitemap, target, 'sitemap.txt');
      }
    },
    writtenAtomFeed: {
      dependencies: ['paths', 'renderedAtomFeed'],
      action({ paths: { target }, renderedAtomFeed }) {
        return writePublicFile(renderedAtomFeed, target, 'atom.xml');
      }
    },
    writtenPosts: {
      dependencies: ['paths', 'renderedPosts'],
      action({ paths: { target }, renderedPosts }) {
        return renderedPosts.map(post => writePublicFile(post.html, target, 'blog', post.filename));
      }
    },
    writtenNotes: {
      dependencies: ['paths', 'renderedNotes'],
      action({ paths: { target }, renderedNotes }) {
        return renderedNotes.map(note => writePublicFile(note.html, target, 'notes', note.filename));
      }
    },
    writtenLinks: {
      dependencies: ['paths', 'renderedLinks'],
      action({ paths: { target }, renderedLinks }) {
        return renderedLinks.map(note => writePublicFile(note.html, target, 'links', note.filename));
      }
    },
    writtenLikes: {
      dependencies: ['paths', 'renderedLikes'],
      action({ paths: { target }, renderedLikes }) {
        return renderedLikes.map(note => writePublicFile(note.html, target, 'likes', note.filename));
      }
    },
    writtenReplies: {
      dependencies: ['paths', 'renderedReplies'],
      action({ paths: { target }, renderedReplies }) {
        return renderedReplies.map(note => writePublicFile(note.html, target, 'replies', note.filename));
      }
    },
    writtenTags: {
      dependencies: ['paths', 'collatedTags'],
      action({ paths: { target }, collatedTags }) {
        return collatedTags.map(tag => writePublicFile(tag.html, target, 'tags', tag.filename));
      }
    }
  });

  return graph;
};

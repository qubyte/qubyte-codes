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

function makeWriteEntries({ renderedDependencies, pathFragment }) {
  return {
    dependencies: ['paths', renderedDependencies],
    action({ paths: { target }, [renderedDependencies]: rendered }) {
      return rendered.map(({ html, filename }) => writePublicFile(html, target, pathFragment, filename));
    }
  };
}

// This is where it all kicks off. This function loads posts and templates,
// renders it all to files, and saves them to the public directory.
exports.build = async function build({ baseUrl, baseTitle, dev, syndications }) {
  const graph = new ExecutionGraph();

  await graph.addNodes({
    paths: {
      action() {
        return {
          source: path.join(__dirname, 'src'),
          target: path.join(__dirname, 'public'),
          content: path.join(__dirname, 'content'),
          async makeDirectory(...pathParts) {
            const directory = path.join(__dirname, 'public', ...pathParts);

            await fs.rmdir(directory, { recursive: true });
            await fs.mkdir(directory);

            return directory;
          }
        };
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
    japaneseNotesFiles: {
      dependencies: ['paths'],
      action({ paths: { content } }) {
        return loadPostFiles(path.join(content, 'japanese-notes'), baseUrl, 'japanese-notes');
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
    cssDirectory: {
      dependencies: ['paths', 'publicDirectory'],
      action({ paths: { makeDirectory } }) {
        return makeDirectory('css');
      }
    },
    blogDirectory: {
      dependencies: ['paths', 'publicDirectory'],
      action({ paths: { makeDirectory } }) {
        return makeDirectory('blog');
      }
    },
    japaneseNotesDirectory: {
      dependencies: ['paths', 'publicDirectory'],
      action({ paths: { makeDirectory } }) {
        return makeDirectory('japanese-notes');
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
        const copy = (dir, subDir) => cpy(path.join(dir, subDir, '*'), path.join(target, subDir));

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
    renderedJapaneseNotes: {
      dependencies: ['css', 'templates', 'japaneseNotesFiles'],
      action({ japaneseNotesFiles: resources, templates: { blog: template }, css: cssPath }) {
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
    extraCssFiles: {
      dependencies: ['postFiles', 'cssDirectory'],
      async action({ postFiles, cssDirectory }) {
        await Promise.all(postFiles.map(post => {
          return post.extraStyleFile && fs.writeFile(
            path.join(cssDirectory, `${post.extraStyleFile.slug}.css`),
            post.extraStyleFile.content
          );
        }));
      }
    },
    renderedBlogIndex: {
      dependencies: ['css', 'templates', 'postFiles'],
      action({ postFiles: posts, templates, css: cssPath }) {
        return templates.blogs({
          blurb: 'This is a collection of my blog posts. If you use a feed reader, <a href="/blog.atom.xml">you can subscribe</a>!',
          posts,
          cssPath,
          dev,
          baseUrl,
          localUrl: '/blog',
          title: 'Archive'
        });
      }
    },
    renderedJapaneseNotesIndex: {
      dependencies: ['css', 'templates', 'japaneseNotesFiles'],
      action({ japaneseNotesFiles: posts, templates, css: cssPath }) {
        return templates.blogs({
          blurb: 'This is a collection of my notes taken as I learn to use the Japanese language.',
          posts,
          cssPath,
          dev,
          baseUrl,
          localUrl: '/japanese-notes',
          title: 'Archive'
        });
      }
    },
    renderedNotesIndex: {
      dependencies: ['css', 'templates', 'noteFiles'],
      action({ noteFiles: notes, templates, css: cssPath }) {
        return templates.notes({
          blurb: 'This is a collection of my notes. If you use a feed reader, <a href="/social.atom.xml">you can subscribe</a>!',
          notes,
          cssPath,
          dev,
          baseUrl,
          localUrl: '/notes',
          title: 'Notes'
        });
      }
    },
    renderedLinksIndex: {
      dependencies: ['css', 'templates', 'linkFiles'],
      action({ linkFiles: links, templates, css: cssPath }) {
        return templates.links({
          blurb: 'This is a collection of links I find interesting. If you use a feed reader, <a href="/social.atom.xml">you can subscribe</a>!', // eslint-disable-line max-len
          links,
          cssPath,
          dev,
          baseUrl,
          localUrl: '/links',
          title: 'Links'
        });
      }
    },
    renderedLikesIndex: {
      dependencies: ['css', 'templates', 'likeFiles'],
      action({ likeFiles: likes, templates, css: cssPath }) {
        return templates.likes({
          blurb: 'This is a collection of things I like on the web. If you use a feed reader, <a href="/social.atom.xml">you can subscribe</a>!', // eslint-disable-line max-len
          likes,
          cssPath,
          dev,
          baseUrl,
          localUrl: '/likes',
          title: 'Likes'
        });
      }
    },
    renderedRepliesIndex: {
      dependencies: ['css', 'templates', 'replyFiles'],
      action({ replyFiles: replies, templates, css: cssPath }) {
        return templates.replies({
          blurb: 'This is a collection of things on the web I have replied to. If you use a feed reader, <a href="/social.atom.xml">you can subscribe</a>!', // eslint-disable-line max-len
          replies,
          cssPath,
          dev,
          baseUrl,
          localUrl: '/replies',
          title: 'Replies'
        });
      }
    },
    renderedAbout: {
      dependencies: ['css', 'templates'],
      action({ templates, css: cssPath }) {
        return templates.about({
          cssPath,
          dev,
          baseUrl,
          localUrl: '/',
          title: 'About',
          description: 'The personal site of Mark Stanley Everitt.'
        });
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
    renderedAtomFeeds: {
      dependencies: ['templates', 'commitTime', 'postFiles', 'noteFiles', 'linkFiles', 'likeFiles', 'replyFiles'],
      action({ templates, commitTime, postFiles, noteFiles, linkFiles, likeFiles, replyFiles }) {
        function descending(a, b) {
          return a.timestamp - b.timestamp;
        }

        const social = [...noteFiles, ...linkFiles, ...likeFiles, ...replyFiles].sort(descending);
        const posts = [...postFiles].sort(descending);
        const all = [...posts, ...social].sort(descending);

        return {
          all: templates.atom({ name: 'atom', items: all, baseUrl, updated: commitTime }),
          posts: templates.atom({ name: 'blog.atom', items: posts, baseUrl, updated: commitTime }),
          social: templates.atom({ name: 'social.atom', items: social, baseUrl, updated: commitTime })
        };
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
    writtenJapaneseNotesIndex: {
      dependencies: ['paths', 'renderedJapaneseNotesIndex'],
      action({ paths: { target }, renderedJapaneseNotesIndex }) {
        return writePublicFile(renderedJapaneseNotesIndex, target, 'japanese-notes', 'index.html');
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
    writtenAtomFeeds: {
      dependencies: ['paths', 'renderedAtomFeeds'],
      action({ paths: { target }, renderedAtomFeeds: { all, posts, social } }) {
        return Promise.all([
          writePublicFile(all, target, 'atom.xml'),
          writePublicFile(posts, target, 'blog.atom.xml'),
          writePublicFile(social, target, 'social.atom.xml')
        ]);
      }
    },
    writtenPosts: makeWriteEntries({ renderedDependencies: 'renderedPosts', pathFragment: 'blog' }),
    writtenJapaneseNotes: makeWriteEntries({ renderedDependencies: 'renderedJapaneseNotes', pathFragment: 'japanese-notes' }),
    writtenNotes: makeWriteEntries({ renderedDependencies: 'renderedNotes', pathFragment: 'notes' }),
    writtenLinks: makeWriteEntries({ renderedDependencies: 'renderedLinks', pathFragment: 'links' }),
    writtenLikes: makeWriteEntries({ renderedDependencies: 'renderedLikes', pathFragment: 'likes' }),
    writtenReplies: makeWriteEntries({ renderedDependencies: 'renderedReplies', pathFragment: 'replies' }),
    writtenTags: makeWriteEntries({ renderedDependencies: 'collatedTags', pathFragment: 'tags' })
  });

  return graph;
};

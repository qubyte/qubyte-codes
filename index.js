/* eslint max-lines: off */

import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { once } from 'events';

import loadTemplates from './lib/templates.js';
import { generateMainCss, generateSpecificCss } from './lib/generate-css.js';
import loadPostFiles from './lib/load-post-files.js';
import loadNoteFiles from './lib/load-note-files.js';
import loadLinkFiles from './lib/load-link-files.js';
import loadLikeFiles from './lib/load-like-files.js';
import loadReplyFiles from './lib/load-reply-files.js';
import collateTags from './lib/collate-tags.js';
import getLastCommitTime from './lib/get-last-commit-time.js';
import ExecutionGraph from './lib/execution-graph.js';

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

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// This is where it all kicks off. This function loads posts and templates,
// renders it all to files, and saves them to the public directory.
export async function build({ baseUrl, baseTitle, dev, syndications }) {
  const sourcePath = path.join(__dirname, 'src');
  const contentPath = path.join(__dirname, 'content');
  const targetPath = path.join(__dirname, 'public');

  let watcher = null;

  if (dev) {
    const { watch } = await import('chokidar');
    watcher = watch([sourcePath, contentPath]);
    await once(watcher, 'ready');
  }

  const graph = new ExecutionGraph({ watcher });

  await graph.addNodes({
    paths: {
      action() {
        return {
          source: sourcePath,
          target: targetPath,
          content: contentPath,
          async makeDirectory(...pathParts) {
            const directory = path.join(targetPath, ...pathParts);

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
      async action({ paths: { source } }) {
        const templatesPath = path.join(source, 'templates');
        const templates = await loadTemplates(templatesPath, { baseTitle });

        return ExecutionGraph.createWatchableResult({
          path: templatesPath,
          result: templates
        });
      }
    },
    feeds: {
      dependencies: ['paths'],
      async action({ paths: { content } }) {
        const feedsPath = path.join(content, 'feeds.json');
        const json = await fs.readFile(feedsPath, 'utf8');

        return ExecutionGraph.createWatchableResult({
          path: feedsPath,
          result: JSON.parse(json)
        });
      }
    },
    publications: {
      dependencies: ['paths'],
      async action({ paths: { content } }) {
        const publicationsPath = path.join(content, 'publications.json');
        const json = await fs.readFile(publicationsPath, 'utf8');

        return ExecutionGraph.createWatchableResult({
          path: publicationsPath,
          result: JSON.parse(json)
        });
      }
    },
    postFiles: {
      dependencies: ['paths', 'extraCss'],
      async action({ paths: { content }, extraCss }) {
        const postsPath = path.join(content, 'posts');

        return ExecutionGraph.createWatchableResult({
          path: postsPath,
          result: await loadPostFiles(postsPath, baseUrl, 'blog', extraCss)
        });
      }
    },
    japaneseNotesFiles: {
      dependencies: ['paths'],
      async action({ paths: { content } }) {
        const notesPath = path.join(content, 'japanese-notes');

        return ExecutionGraph.createWatchableResult({
          path: notesPath,
          result: await loadPostFiles(notesPath, baseUrl, 'japanese-notes')
        });
      }
    },
    noteFiles: {
      dependencies: ['paths'],
      async action({ paths: { content } }) {
        const notesPath = path.join(content, 'notes');

        return ExecutionGraph.createWatchableResult({
          path: notesPath,
          result: await loadNoteFiles(notesPath, syndications)
        });
      }
    },
    linkFiles: {
      dependencies: ['paths'],
      async action({ paths: { content } }) {
        const linksPath = path.join(content, 'links');

        return ExecutionGraph.createWatchableResult({
          path: linksPath,
          result: await loadLinkFiles(linksPath, syndications)
        });
      }
    },
    likeFiles: {
      dependencies: ['paths'],
      async action({ paths: { content } }) {
        const likesPath = path.join(content, 'likes');

        return ExecutionGraph.createWatchableResult({
          path: likesPath,
          result: await loadLikeFiles(likesPath, syndications)
        });
      }
    },
    replyFiles: {
      dependencies: ['paths'],
      async action({ paths: { content } }) {
        const repliesPath = path.join(content, 'replies');

        return ExecutionGraph.createWatchableResult({
          path: repliesPath,
          result: await loadReplyFiles(repliesPath)
        });
      }
    },
    publicDirectory: {
      dependencies: ['paths'],
      action({ paths: { makeDirectory } }) {
        return makeDirectory();
      }
    },
    stylesDirectory: {
      dependencies: ['paths', 'publicDirectory'],
      action({ paths: { makeDirectory } }) {
        return makeDirectory('styles');
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
    iconsTarget: {
      dependencies: ['paths', 'publicDirectory'],
      async action({ paths: { source, makeDirectory } }) {
        return ExecutionGraph.createWatchableResult({
          path: path.join(source, 'icons'),
          result: await makeDirectory('icons')
        });
      }
    },
    icons: {
      dependencies: ['paths', 'iconsTarget'],
      async action({ paths: { source }, iconsTarget }) {
        const directory = path.join(source, 'icons');
        const items = (await fs.readdir(directory)).filter(i => i.endsWith('.png') || i.endsWith('.svg'));

        await Promise.all(
          items.map(
            item => fs.copyFile(
              path.join(directory, item),
              path.join(iconsTarget, item)
            )
          )
        );
      }
    },
    fontsTarget: {
      dependencies: ['paths', 'publicDirectory'],
      async action({ paths: { source, makeDirectory } }) {
        return ExecutionGraph.createWatchableResult({
          path: path.join(source, 'fonts'),
          result: await makeDirectory('fonts')
        });
      }
    },
    fonts: {
      dependencies: ['paths', 'fontsTarget'],
      async action({ paths: { source }, fontsTarget }) {
        const directory = path.join(source, 'fonts');
        const items = (await fs.readdir(directory)).filter(i => i.endsWith('.woff') || i.endsWith('.woff2'));

        await Promise.all(
          items.map(
            item => fs.copyFile(
              path.join(directory, item),
              path.join(fontsTarget, item)
            )
          )
        );
      }
    },
    imgTarget: {
      dependencies: ['paths', 'publicDirectory'],
      async action({ paths: { source, makeDirectory } }) {
        return ExecutionGraph.createWatchableResult({
          path: path.join(source, 'img'),
          result: await makeDirectory('img')
        });
      }
    },
    img: {
      dependencies: ['paths', 'imgTarget'],
      async action({ paths: { source }, imgTarget }) {
        const directory = path.join(source, 'img');
        const items = (await fs.readdir(directory)).filter(i => i.endsWith('.jpg'));

        await Promise.all(
          items.map(
            item => fs.copyFile(
              path.join(directory, item),
              path.join(imgTarget, item)
            )
          )
        );
      }
    },
    scriptsTarget: {
      dependencies: ['paths', 'publicDirectory'],
      async action({ paths: { source, makeDirectory } }) {
        return ExecutionGraph.createWatchableResult({
          path: path.join(source, 'scripts'),
          result: await makeDirectory('scripts')
        });
      }
    },
    scripts: {
      dependencies: ['paths', 'scriptsTarget'],
      async action({ paths: { content }, scriptsTarget }) {
        const directory = path.join(content, 'scripts');
        const items = (await fs.readdir(directory)).filter(i => i.endsWith('.js'));

        await Promise.all(
          items.map(
            item => fs.copyFile(
              path.join(directory, item),
              path.join(scriptsTarget, item)
            )
          )
        );
      }
    },
    papersTarget: {
      dependencies: ['paths', 'publicDirectory'],
      async action({ paths: { source, makeDirectory } }) {
        return ExecutionGraph.createWatchableResult({
          path: path.join(source, 'papers'),
          result: await makeDirectory('papers')
        });
      }
    },
    papers: {
      dependencies: ['paths', 'papersTarget'],
      async action({ paths: { content }, papersTarget }) {
        const directory = path.join(content, 'papers');
        const items = (await fs.readdir(directory)).filter(i => i.endsWith('.pdf'));

        await Promise.all(
          items.map(
            item => fs.copyFile(
              path.join(directory, item),
              path.join(papersTarget, item)
            )
          )
        );
      }
    },
    imagesTarget: {
      dependencies: ['paths', 'publicDirectory'],
      async action({ paths: { source, makeDirectory } }) {
        return ExecutionGraph.createWatchableResult({
          path: path.join(source, 'images'),
          result: await makeDirectory('images')
        });
      }
    },
    images: {
      dependencies: ['paths', 'imagesTarget'],
      async action({ paths: { content }, imagesTarget }) {
        const directory = path.join(content, 'images');
        const items = (await fs.readdir(directory)).filter(i => i.endsWith('.js'));

        await Promise.all(
          items.map(
            item => fs.copyFile(
              path.join(directory, item),
              path.join(imagesTarget, item)
            )
          )
        );
      }
    },
    googleSiteVerification: {
      dependencies: ['paths', 'publicDirectory'],
      action({ paths: { target } }) {
        const name = 'google91826e4f943d9ee9.html';
        return fs.writeFile(path.join(target, name), `google-site-verification: ${name}\n`);
      }
    },
    keybaseVerification: {
      dependencies: ['paths', 'publicDirectory'],
      async action({ paths: { source, target } }) {
        const verificationPath = path.join(source, 'keybase.txt');

        await fs.copyFile(verificationPath, path.join(target, 'keybase.txt'));

        return ExecutionGraph.createWatchableResult({
          path: verificationPath,
          result: null
        });
      }
    },
    robotsFile: {
      dependencies: ['paths', 'publicDirectory'],
      async action({ paths: { source, target } }) {
        const verificationPath = path.join(source, 'robots.txt');

        await fs.copyFile(verificationPath, path.join(target, 'robots.txt'));

        return ExecutionGraph.createWatchableResult({
          path: verificationPath,
          result: null
        });
      }
    },
    indexJsFile: {
      dependencies: ['paths', 'publicDirectory'],
      async action({ paths: { source, target } }) {
        const verificationPath = path.join(source, 'index.js');

        await fs.copyFile(verificationPath, path.join(target, 'index.js'));

        return ExecutionGraph.createWatchableResult({
          path: verificationPath,
          result: null
        });
      }
    },
    serviceWorkerFile: {
      dependencies: ['paths', 'publicDirectory'],
      async action({ paths: { source, target } }) {
        const verificationPath = path.join(source, 'sw.js');

        await fs.copyFile(verificationPath, path.join(target, 'sw.js'));

        return ExecutionGraph.createWatchableResult({
          path: verificationPath,
          result: null
        });
      }
    },
    manifestFile: {
      dependencies: ['paths', 'publicDirectory'],
      async action({ paths: { source, target } }) {
        const verificationPath = path.join(source, 'manifest.json');

        await fs.copyFile(verificationPath, path.join(target, 'manifest.json'));

        return ExecutionGraph.createWatchableResult({
          path: verificationPath,
          result: null
        });
      }
    },
    css: {
      dependencies: ['paths', 'publicDirectory'],
      async action({ paths: { source, target } }) {
        const cssPath = path.join(source, 'css');

        return ExecutionGraph.createWatchableResult({
          path: cssPath,
          result: await generateMainCss(cssPath, target, 'entry.css', 'default')
        });
      }
    },
    extraCss: {
      dependencies: ['paths', 'stylesDirectory'],
      async action({ paths: { content }, stylesDirectory }) {
        const cssPath = path.join(content, 'styles');

        return ExecutionGraph.createWatchableResult({
          path: cssPath,
          result: await generateSpecificCss(cssPath, stylesDirectory)
        });
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
      dependencies: ['css', 'templates', 'publications'],
      action({ templates, css: cssPath, publications }) {
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
    writtenOpml: {
      dependencies: ['paths', 'templates', 'feeds'],
      action({ paths: { target }, templates, feeds }) {
        const content = templates.feeds({ feeds });
        return writePublicFile(content, target, 'feeds.opml');
      }
    },
    writtenBlogroll: {
      dependencies: ['css', 'paths', 'templates', 'feeds'],
      action({ css: cssPath, paths: { target }, templates, feeds }) {
        const content = templates.blogroll({
          feeds,
          cssPath,
          dev,
          baseUrl,
          localUrl: '/blogroll',
          title: 'Blogroll'
        });
        return writePublicFile(content, target, 'blogroll.html');
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
}

/* eslint max-lines: off */

import { pathToFileURL } from 'node:url';
import { readdir, writeFile, rm, mkdir, readFile, copyFile, cp, unlink, watch } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join as pathJoin } from 'node:path';

import sharp from 'sharp';

import loadTemplates from './lib/templates.js';
import { generateMainCss, generateSpecificCss } from './lib/generate-css.js';
import loadPostFiles from './lib/load-post-files.js';
import loadNoteFiles from './lib/load-note-files.js';
import loadStudySessionsFiles from './lib/load-study-session-files.js';
import loadLinkFiles from './lib/load-link-files.js';
import loadLikeFiles from './lib/load-like-files.js';
import loadReplyFiles from './lib/load-reply-files.js';
import buildBacklinks from './lib/build-backlinks.js';
import collateTags from './lib/collate-tags.js';
import getLastCommitTime from './lib/get-last-commit-time.js';
import ExecutionGraph, { GraphNode, WatchableResult } from './lib/execution-graph.js';
import hashCopy from './lib/hash-copy.js';
import NetlifyHeaders from './lib/netlify-headers.js';

const basePath = new URL('./', import.meta.url);
const sourcePath = new URL('./src/', import.meta.url);
const contentPath = new URL('./content/', import.meta.url);
const targetPath = new URL('./public/', import.meta.url);

/**
 * @param {object} options
 * @param {boolean} options.noIndex
 * @param {import('./lib/page.js').default[]} options.resources
 * @param {string} options.cssPath
 * @param {string|URL} options.baseUrl
 * @param {Record<string, any>} options.backlinks
 * @param {boolean} options.dev
 */
function renderResources({ noIndex, resources, template, cssPath, baseUrl, backlinks = {}, dev }) {
  return resources.map(resource => ({
    content: template({ ...resource, noIndex, cssPath, baseUrl, backlinks: backlinks[resource.localUrl], dev }),
    filename: resource.filename
  }));
}

function makeWriteEntries({ name, renderedDependencies, pathFragment }) {
  return new GraphNode({
    name,
    dependencies: ['targetPath', renderedDependencies],
    action({ [renderedDependencies]: rendered }) {
      return rendered.map(({ content, filename }) => {
        const path = pathFragment ? `${pathFragment}/${filename}` : filename;
        return writeFile(new URL(path, targetPath), content);
      });
    }
  });
}

function writeRendered(name, renderedName, path) {
  return new GraphNode({
    name,
    dependencies: ['targetPath', renderedName],
    action(config) {
      return writeFile(new URL(path, targetPath), config[renderedName]);
    }
  });
}

async function copyStaticDirectory(sourceDirectory, targetDirectory, allowedFileEndings) {
  await cp(sourceDirectory, targetDirectory, {
    filter(src) {
      return pathToFileURL(src).pathname === sourceDirectory.pathname || allowedFileEndings.includes(extname(src));
    },
    recursive: true
  });

  return new WatchableResult({ path: sourceDirectory, result: targetDirectory });
}

async function makeDirectory(path) {
  const directory = new URL(path, targetPath);

  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });

  return directory;
}

function makeDirectoryNode(name, path, watchPath) {
  return new GraphNode({
    name,
    dependencies: ['targetPath'],
    async action() {
      const result = await makeDirectory(path);

      return watchPath ? new WatchableResult({ path: watchPath, result }) : result;
    }
  });
}

async function* makeWatcher() {
  for await (const { eventType, filename } of watch('./', { recursive: true })) {
    if (filename && (filename.startsWith('content/') || filename.startsWith('src/'))) {
      yield { eventType, url: pathToFileURL(pathJoin(import.meta.dirname, filename)) };
    }
  }
}

// This is where it all kicks off. This function loads posts and templates,
// renders it all to files, and saves them to the public directory.
export async function build({ baseUrl, baseTitle, repoUrl, dev }) {
  const watcher = dev ? makeWatcher() : null;
  const graph = new ExecutionGraph({ watcher });

  await graph.addNodes([
    new GraphNode({
      name: 'targetPath',
      async action() {
        await rm(targetPath, { recursive: true, force: true });
        await mkdir(targetPath);
      }
    }),
    function commitTime() {
      return getLastCommitTime(contentPath);
    },
    async function templates() {
      const path = new URL('templates/', sourcePath);
      const result = await loadTemplates(path, { baseTitle });

      return new WatchableResult({ path, result });
    },
    async function feeds() {
      const feedsPath = new URL('feeds.json', contentPath);
      const json = await readFile(feedsPath, 'utf8');

      return new WatchableResult({ path: feedsPath, result: JSON.parse(json) });
    },
    async function publications() {
      const publicationsPath = new URL('publications.json', contentPath);
      const json = await readFile(publicationsPath, 'utf8');

      return new WatchableResult({ path: publicationsPath, result: JSON.parse(json) });
    },
    new GraphNode({
      name: 'specialFiles',
      dependencies: ['extraCss', 'hashedScripts', 'images'],
      async action({ extraCss, hashedScripts, images }) {
        const specialPath = new URL('special/', contentPath);

        return new WatchableResult({
          path: specialPath,
          result: await loadPostFiles({ path: specialPath, basePath, repoUrl, baseUrl, extraCss, hashedScripts, type: null, images })
        });
      }
    }),
    new GraphNode({
      name: 'postFiles',
      dependencies: ['extraCss', 'mathStyles', 'codeStyle', 'hashedScripts', 'images'],
      async action({ extraCss, mathStyles, codeStyle, hashedScripts, images }) {
        const postsPath = new URL('posts/', contentPath);
        const joinedStyles = new Map([...extraCss, ...mathStyles, ...codeStyle]);

        return new WatchableResult({
          path: postsPath,
          result: await loadPostFiles({
            path: postsPath,
            basePath,
            repoUrl,
            baseUrl,
            extraCss:
            joinedStyles,
            hashedScripts,
            type: 'blog',
            images
          })
        });
      }
    }),
    new GraphNode({
      name: 'populateHeaders',
      dependencies: ['targetPath', 'postFiles', 'specialFiles'],
      action({ postFiles, specialFiles }) {
        const headers = new NetlifyHeaders();

        for (const post of [...postFiles, ...specialFiles]) {
          const customHeaders = [];

          if (post.importMap) {
            const hash = createHash('sha256')
              .update(post.importMap)
              .digest('base64');

            customHeaders.push([
              'Content-Security-Policy',
              `default-src 'self'; script-src 'sha256-${hash}' 'self'; img-src *;`
            ]);
          }
          for (const [key, val] of Object.entries(post.customHeaders || {})) {
            customHeaders.push([key, val]);
          }

          if (customHeaders.length) {
            headers.addHeaders(post.localUrl, customHeaders);
          }
        }

        writeFile(new URL('_headers', targetPath), `${headers.generate()}\n`);
      }
    }),
    new GraphNode({
      name: 'japaneseNotesFiles',
      dependencies: ['hashedScripts', 'images'],
      async action({ hashedScripts, images }) {
        const notesPath = new URL('japanese-notes/', contentPath);
        const type = 'japanese-notes';

        return new WatchableResult({
          path: notesPath,
          result: await loadPostFiles({ path: notesPath, basePath, repoUrl, baseUrl, type, hashedScripts, images })
        });
      }
    }),
    new GraphNode({
      name: 'noteFiles',
      dependencies: ['images'],
      async action({ images: imagesDimensions }) {
        const dir = new URL('notes/', contentPath);

        return new WatchableResult({ path: dir, result: await loadNoteFiles({ baseUrl, dir, imagesDimensions }) });
      }
    }),
    async function studySessionFiles() {
      const dir = new URL('study-sessions/', contentPath);

      return new WatchableResult({ path: dir, result: await loadStudySessionsFiles({ baseUrl, dir }) });
    },
    async function linkFiles() {
      const dir = new URL('links/', contentPath);

      return new WatchableResult({ path: dir, result: await loadLinkFiles({ baseUrl, dir }) });
    },
    async function likeFiles() {
      const dir = new URL('likes/', contentPath);

      return new WatchableResult({ path: dir, result: await loadLikeFiles({ baseUrl, dir }) });
    },
    async function replyFiles() {
      const dir = new URL('replies/', contentPath);

      return new WatchableResult({ path: dir, result: await loadReplyFiles({ baseUrl, dir }) });
    },
    makeDirectoryNode('stylesDirectory', 'styles/'),
    makeDirectoryNode('blogDirectory', 'blog/'),
    makeDirectoryNode('japaneseNotesDirectory', 'japanese-notes/'),
    makeDirectoryNode('notesDirectory', 'notes/'),
    makeDirectoryNode('studySessionsDirectory', 'study-sessions/'),
    makeDirectoryNode('linksDirectory', 'links/'),
    makeDirectoryNode('likesDirectory', 'likes/'),
    makeDirectoryNode('repliesDirectory', 'replies/'),
    makeDirectoryNode('tagsDirectory', 'tags/'),
    makeDirectoryNode('imagesTarget', 'images/', new URL('images/', sourcePath)),
    new GraphNode({
      name: 'activitypubDocuments',
      dependencies: ['targetPath'],
      action() {
        const sourceDirectory = new URL('activitypub/', sourcePath);
        const targetDirectory = new URL('activitypub/', targetPath);

        return copyStaticDirectory(sourceDirectory, targetDirectory, ['.json']);
      }
    }),
    new GraphNode({
      name: 'fingerTarget',
      dependencies: ['targetPath'],
      async action() {
        const wellKnownDirectory = await makeDirectory('.well-known/');

        await writeFile(new URL('webfinger', wellKnownDirectory), JSON.stringify({
          subject: 'acct:qubyte@qubyte.codes',
          links: [
            {
              rel: 'self',
              type: 'application/activity+json',
              href: 'https://qubyte.codes/activitypub/actor.json'
            }
          ]
        }));
      }
    }),
    new GraphNode({
      name: 'icons',
      dependencies: ['targetPath'],
      action() {
        const sourceDirectory = new URL('icons/', sourcePath);
        const targetDirectory = new URL('icons/', targetPath);

        return copyStaticDirectory(sourceDirectory, targetDirectory, ['.png', '.svg']);
      }
    }),
    new GraphNode({
      name: 'img',
      dependencies: ['targetPath'],
      action() {
        const sourceDirectory = new URL('img/', sourcePath);
        const targetDirectory = new URL('img/', targetPath);

        return copyStaticDirectory(sourceDirectory, targetDirectory, ['.jpg', '.jpeg', '.webp', '.avif']);
      }
    }),
    new GraphNode({
      name: 'scripts',
      dependencies: ['targetPath'],
      action() {
        const sourceDirectory = new URL('scripts/', contentPath);
        const targetDirectory = new URL('scripts/', targetPath);

        return copyStaticDirectory(sourceDirectory, targetDirectory, ['.js']);
      }
    }),
    new GraphNode({
      name: 'hashedScripts',
      dependencies: ['targetPath', 'scripts'],
      async action({ scripts }) {
        const path = new URL('scripts/', contentPath);
        const items = (await readdir(path)).filter(i => i.endsWith('.js'));
        const entries = await Promise.all(items.map(item => hashCopy(targetPath, new URL(item, path), scripts)));
        const result = Object.fromEntries(entries);

        return new WatchableResult({ path, result });
      }
    }),
    new GraphNode({
      name: 'papers',
      dependencies: ['targetPath'],
      action() {
        const sourceDirectory = new URL('papers/', contentPath);
        const targetDirectory = new URL('papers/', targetPath);

        return copyStaticDirectory(sourceDirectory, targetDirectory, ['.pdf']);
      }
    }),
    new GraphNode({
      name: 'images',
      dependencies: ['imagesTarget'],
      async action({ imagesTarget }) {
        const directory = new URL('images/', contentPath);
        const items = (await readdir(directory)).filter(i => !i.startsWith('.'));

        return new Map(await Promise.all(
          items.map(async item => {
            const sourceFile = await readFile(new URL(item, directory));
            const { width, height } = await sharp(sourceFile).metadata();

            await writeFile(new URL(item, imagesTarget), sourceFile);

            return [`/images/${item}`, { width, height }];
          })
        ));
      }
    }),
    new GraphNode({
      name: 'googleSiteVerification',
      dependencies: ['targetPath'],
      action() {
        const name = 'google91826e4f943d9ee9.html';
        return writeFile(new URL(name, targetPath), `google-site-verification: ${name}\n`);
      }
    }),
    new GraphNode({
      name: 'keybaseVerification',
      dependencies: ['targetPath'],
      async action() {
        const verificationPath = new URL('keybase.txt', sourcePath);

        await copyFile(verificationPath, new URL('keybase.txt', targetPath));

        return new WatchableResult({ path: verificationPath, result: null });
      }
    }),
    new GraphNode({
      name: 'robotsFile',
      dependencies: ['targetPath'],
      async action() {
        const robotsPath = new URL('robots.txt', sourcePath);

        await copyFile(robotsPath, new URL('robots.txt', targetPath));

        return new WatchableResult({ path: robotsPath, result: null });
      }
    }),
    new GraphNode({
      name: 'css',
      dependencies: ['targetPath'],
      async action() {
        const { url, htmlPath } = await generateMainCss({
          entry: new URL('css/entry.css', sourcePath),
          targetDirectory: targetPath
        });

        return new WatchableResult({ path: new URL('css/', sourcePath), result: { url, cssPath: htmlPath } });
      },
      onRemove() {
        return unlink(this.result.url);
      }
    }),
    new GraphNode({
      name: 'extraCss',
      dependencies: ['stylesDirectory'],
      async action({ stylesDirectory }) {
        const cssPath = new URL('styles/', contentPath);

        return new WatchableResult({
          path: cssPath,
          result: await generateSpecificCss(cssPath, stylesDirectory)
        });
      }
    }),
    new GraphNode({
      name: 'mathsFontName',
      dependencies: ['stylesDirectory'],
      async action({ stylesDirectory }) {
        const readWoff = await readFile(new URL('node_modules/temml/dist/Temml.woff2', basePath));
        const woffHash = createHash('md5')
          .update(readWoff)
          .digest('hex');
        const hashedWoffName = `hashed-temml-${woffHash}.woff2`;
        const path = new URL(hashedWoffName, stylesDirectory);

        await writeFile(path, readWoff);

        return new WatchableResult({ path, result: { woffName: hashedWoffName, url: path } });
      },
      onRemove() {
        return unlink(this.result.url);
      }
    }),
    new GraphNode({
      name: 'mathStyles',
      dependencies: ['stylesDirectory', 'mathsFontName'],
      async action({ stylesDirectory, mathsFontName }) {
        const cssPath = new URL('node_modules/temml/dist/Temml-Local.css', basePath);
        const css = await readFile(cssPath, 'utf8');
        const updatedCss = css.replaceAll('Temml.woff2', `/styles/${mathsFontName.woffName}`);
        const cssHash = createHash('md5')
          .update(updatedCss)
          .digest('hex');
        const hashedCssName = `hashed-temml-local-${cssHash}.css`;

        await writeFile(new URL(hashedCssName, stylesDirectory), updatedCss);

        return new WatchableResult({
          path: cssPath,
          result: new Map([['/styles/temml.css', `/styles/${hashedCssName}`]])
        });
      },
      onRemove() {
        // todo
      }
    }),
    new GraphNode({
      name: 'codeStyle',
      dependencies: ['stylesDirectory'],
      async action({ stylesDirectory }) {
        const cssPath = new URL('node_modules/highlight.js/styles/default.css', basePath);
        const css = await readFile(cssPath, 'utf8');
        const cssHash = createHash('md5')
          .update(css)
          .digest('hex');
        const hashedCssName = `hashed-highlightjs-${cssHash}.css`;

        await writeFile(new URL(hashedCssName, stylesDirectory), css);

        return new Map([['/styles/highlightjs.css', `/styles/${hashedCssName}`]]);
      },
      onRemove() {
        // todo
      }
    }),
    new GraphNode({
      name: 'collatedTags',
      dependencies: ['css', 'templates', 'postFiles'],
      action({ postFiles: posts, css: { cssPath }, templates: { tag: template } }) {
        return collateTags({ posts, cssPath, baseUrl, dev, template });
      }
    }),
    new GraphNode({
      name: 'backlinks',
      dependencies: ['japaneseNotesFiles', 'postFiles', 'specialFiles'],
      action({ japaneseNotesFiles, postFiles, specialFiles }) {
        return buildBacklinks([...japaneseNotesFiles, ...postFiles, ...specialFiles]);
      }
    }),
    new GraphNode({
      name: 'renderedShortlinks',
      dependencies: ['templates', 'postFiles'],
      action({ postFiles, templates }) {
        return templates.shortlinks({ name: 'shortlinks', items: postFiles, baseUrl });
      }
    }),
    new GraphNode({
      name: 'renderedSpecials',
      dependencies: ['css', 'templates', 'specialFiles', 'backlinks'],
      action({ specialFiles: resources, backlinks, templates: { blog: template }, css: { cssPath } }) {
        return renderResources({ resources, backlinks, template, cssPath, baseUrl, dev });
      }
    }),
    new GraphNode({
      name: 'renderedPosts',
      dependencies: ['css', 'templates', 'postFiles', 'backlinks'],
      action({ postFiles: resources, backlinks, templates: { blog: template }, css: { cssPath } }) {
        return renderResources({ resources, backlinks, template, cssPath, baseUrl, dev });
      }
    }),
    new GraphNode({
      name: 'renderedJapaneseNotes',
      dependencies: ['css', 'templates', 'japaneseNotesFiles', 'backlinks'],
      action({ japaneseNotesFiles: resources, backlinks, templates: { blog: template }, css: { cssPath } }) {
        return renderResources({ noIndex: true, resources, backlinks, template, cssPath, baseUrl, dev });
      }
    }),
    new GraphNode({
      name: 'renderedNotes',
      dependencies: ['css', 'templates', 'noteFiles'],
      action({ noteFiles: resources, templates: { note: template }, css: { cssPath } }) {
        return renderResources({ noIndex: true, resources, template, cssPath, baseUrl, dev });
      }
    }),
    new GraphNode({
      name: 'renderedStudySessions',
      dependencies: ['css', 'templates', 'studySessionFiles'],
      action({ studySessionFiles: resources, templates: { 'study-session': template }, css: { cssPath } }) {
        return renderResources({ noIndex: true, resources, template, cssPath, baseUrl, dev });
      }
    }),
    new GraphNode({
      name: 'renderedLinks',
      dependencies: ['css', 'templates', 'linkFiles'],
      action({ linkFiles: resources, templates: { link: template }, css: { cssPath } }) {
        return renderResources({ resources, template, cssPath, baseUrl, dev });
      }
    }),
    new GraphNode({
      name: 'renderedLikes',
      dependencies: ['css', 'templates', 'likeFiles'],
      action({ likeFiles: resources, templates: { like: template }, css: { cssPath } }) {
        return renderResources({ resources, template, cssPath, baseUrl, dev });
      }
    }),
    new GraphNode({
      name: 'renderedReplies',
      dependencies: ['css', 'templates', 'replyFiles'],
      action({ replyFiles: resources, templates: { reply: template }, css: { cssPath } }) {
        return renderResources({ resources, template, cssPath, baseUrl, dev });
      }
    }),
    new GraphNode({
      name: 'renderedBlogIndex',
      dependencies: ['css', 'templates', 'postFiles'],
      action({ postFiles: posts, templates, css: { cssPath } }) {
        return templates.blogs({
          blurb: 'This is a collection of my blog posts. If you use a feed reader, <a href="/blog.atom.xml">you can subscribe</a>!',
          posts: posts.map(p => ({ ...p, hasRuby: false })),
          cssPath,
          dev,
          baseUrl,
          localUrl: '/blog',
          title: 'Archive',
          description: 'A collection of my long form articles.'
        });
      }
    }),
    new GraphNode({
      name: 'renderedJapaneseNotesIndex',
      dependencies: ['css', 'templates', 'japaneseNotesFiles'],
      action({ japaneseNotesFiles: posts, templates, css: { cssPath } }) {
        return templates.blogs({
          // eslint-disable-next-line
          blurb: 'This is a collection of my notes taken as I learn to use the Japanese language. Be warned! These documents are <em>not</em> authoritative. They represent my current understanding, which is certainly flawed.',
          noIndex: true,
          posts: posts.map(p => ({ ...p, hasRuby: false })),
          cssPath,
          dev,
          baseUrl,
          localUrl: '/japanese-notes',
          title: 'Japanese Study Notes',
          description: 'A collection of notes I\'ve written on the Japanese language, as I study it.'
        });
      }
    }),
    new GraphNode({
      name: 'renderedNotesIndex',
      dependencies: ['css', 'templates', 'noteFiles'],
      action({ noteFiles: notes, templates, css: { cssPath } }) {
        return templates.notes({
          noIndex: true,
          notes,
          cssPath,
          dev,
          baseUrl,
          localUrl: '/notes',
          title: 'Notes',
          description: 'A collection of my short notes.'
        });
      }
    }),
    new GraphNode({
      name: 'renderedStudySessionsIndex',
      dependencies: ['css', 'templates', 'studySessionFiles'],
      action({ studySessionFiles: studySessions, templates, css: { cssPath } }) {
        return templates['study-sessions']({
          noIndex: true,
          studySessions,
          cssPath,
          dev,
          baseUrl,
          localUrl: '/study-sessions',
          title: 'Study Sessions',
          description: 'A collection of my study sessions.'
        });
      }
    }),
    new GraphNode({
      name: 'renderedLinksIndex',
      dependencies: ['css', 'templates', 'linkFiles'],
      action({ linkFiles: links, templates, css: { cssPath } }) {
        return templates.links({
          links,
          cssPath,
          dev,
          baseUrl,
          localUrl: '/links',
          title: 'Links',
          description: 'A collection of links to articles elsewhere on the web.'
        });
      }
    }),
    new GraphNode({
      name: 'renderedLikesIndex',
      dependencies: ['css', 'templates', 'likeFiles'],
      action({ likeFiles: likes, templates, css: { cssPath } }) {
        return templates.likes({
          likes,
          cssPath,
          dev,
          baseUrl,
          localUrl: '/likes',
          title: 'Likes',
          description: 'A collection of likes of articles elsewhere on the web.'
        });
      }
    }),
    new GraphNode({
      name: 'renderedRepliesIndex',
      dependencies: ['css', 'templates', 'replyFiles'],
      action({ replyFiles: replies, templates, css: { cssPath } }) {
        return templates.replies({
          replies,
          cssPath,
          dev,
          baseUrl,
          localUrl: '/replies',
          title: 'Replies',
          description: 'A collection of the replies to articles elsewhere on the web.'
        });
      }
    }),
    new GraphNode({
      name: 'renderedAbout',
      dependencies: ['css', 'templates'],
      action({ templates, css: { cssPath } }) {
        return templates.about({
          cssPath,
          dev,
          baseUrl,
          localUrl: '/',
          title: 'About',
          description: 'The personal site of Mark Stanley Everitt.'
        });
      }
    }),
    new GraphNode({
      name: 'renderedPublications',
      dependencies: ['css', 'templates', 'publications'],
      action({ templates, css: { cssPath }, publications }) {
        return templates.publications({
          cssPath,
          dev,
          baseUrl,
          localUrl: '/publications',
          publications,
          title: 'Publications',
          description: 'A collection of academic publications I have authored and coauthored.'
        });
      }
    }),
    new GraphNode({
      name: 'renderedFourOhFour',
      dependencies: ['css', 'templates'],
      action({ templates, css: { cssPath } }) {
        return templates[404]({ cssPath, dev, baseUrl, localUrl: '/404', title: 'Not Found' });
      }
    }),
    new GraphNode({
      name: 'renderedWebmentionConfirmation',
      dependencies: ['css', 'templates'],
      action({ templates, css: { cssPath } }) {
        return templates.webmention({
          cssPath,
          dev,
          baseUrl,
          localUrl: '/webmention',
          title: 'Webmention',
          description: 'Your mention is confirmed! Please check back later.'
        });
      }
    }),
    new GraphNode({
      name: 'renderedSitemap',
      dependencies: ['templates', 'collatedTags', 'specialFiles', 'postFiles'],
      action({ templates, collatedTags, specialFiles, postFiles }) {
        const pages = [...specialFiles, ...postFiles];
        return templates.sitemap({ tags: collatedTags, pages, baseUrl });
      }
    }),
    new GraphNode({
      name: 'renderedAtomFeeds',
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
    }),
    writeRendered('writtenIndex', 'renderedAbout', 'index.html'),
    writeRendered('writtenBlogIndex', 'renderedBlogIndex', 'blog/index.html'),
    writeRendered('writtenJapaneseNotesIndex', 'renderedJapaneseNotesIndex', 'japanese-notes/index.html'),
    writeRendered('writtenNotesIndex', 'renderedNotesIndex', 'notes/index.html'),
    writeRendered('writtenStudySessionsIndex', 'renderedStudySessionsIndex', 'study-sessions/index.html'),
    writeRendered('writtenLinksIndex', 'renderedLinksIndex', 'links/index.html'),
    writeRendered('writtenLikesIndex', 'renderedLikesIndex', 'likes/index.html'),
    writeRendered('writtenRepliesIndex', 'renderedRepliesIndex', 'replies/index.html'),
    writeRendered('writtenPublications', 'renderedPublications', 'publications.html'),
    writeRendered('writtenWebmentionConfirmation', 'renderedWebmentionConfirmation', 'webmention.html'),
    writeRendered('writtenFourOhFour', 'renderedFourOhFour', '404.html'),
    writeRendered('writtenSitemap', 'renderedSitemap', 'sitemap.txt'),
    writeRendered('writtenShortlinks', 'renderedShortlinks', 'shortlinks.txt'),
    new GraphNode({
      name: 'writtenAtomFeeds',
      dependencies: ['targetPath', 'renderedAtomFeeds'],
      action({ renderedAtomFeeds: { all, posts, social } }) {
        return Promise.all([
          writeFile(new URL('atom.xml', targetPath), all),
          writeFile(new URL('blog.atom.xml', targetPath), posts),
          writeFile(new URL('social.atom.xml', targetPath), social)
        ]);
      }
    }),
    new GraphNode({
      name: 'writtenOpml',
      dependencies: ['targetPath', 'templates', 'feeds'],
      action({ templates, feeds }) {
        return writeFile(new URL('feeds.opml', targetPath), templates.feeds({ feeds }));
      }
    }),
    new GraphNode({
      name: 'writtenBlogroll',
      dependencies: ['css', 'targetPath', 'templates', 'feeds'],
      action({ css: { cssPath }, templates, feeds }) {
        return writeFile(new URL('blogroll.html', targetPath), templates.blogroll({
          feeds,
          cssPath,
          dev,
          baseUrl,
          localUrl: '/blogroll',
          title: 'Blogroll'
        }));
      }
    }),
    makeWriteEntries({ name: 'writtenSpecials', renderedDependencies: 'renderedSpecials', pathFragment: null }),
    makeWriteEntries({ name: 'writtenPosts', renderedDependencies: 'renderedPosts', pathFragment: 'blog' }),
    makeWriteEntries({ name: 'writtenJapaneseNotes', renderedDependencies: 'renderedJapaneseNotes', pathFragment: 'japanese-notes' }),
    makeWriteEntries({ name: 'writtenNotes', renderedDependencies: 'renderedNotes', pathFragment: 'notes' }),
    makeWriteEntries({ name: 'writtenStudySessions', renderedDependencies: 'renderedStudySessions', pathFragment: 'study-sessions' }),
    makeWriteEntries({ name: 'writtenLinks', renderedDependencies: 'renderedLinks', pathFragment: 'links' }),
    makeWriteEntries({ name: 'writtenLikes', renderedDependencies: 'renderedLikes', pathFragment: 'likes' }),
    makeWriteEntries({ name: 'writtenReplies', renderedDependencies: 'renderedReplies', pathFragment: 'replies' }),
    makeWriteEntries({ name: 'writtenTags', renderedDependencies: 'collatedTags', pathFragment: 'tags' }),
    new GraphNode({
      name: 'lastBuild',
      dependencies: ['targetPath', 'writtenSitemap'],
      action() {
        return writeFile(new URL('last-build.txt', targetPath), `${new Date().toISOString()}\n`);
      }
    })
  ]);

  return graph;
}

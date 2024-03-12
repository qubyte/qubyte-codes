/* eslint max-lines: off */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { readdir, writeFile, rm, mkdir, readFile, copyFile, cp, unlink } from 'node:fs/promises';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { extname } from 'node:path';

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
import ExecutionGraph from './lib/execution-graph.js';
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

function makeWriteEntries({ renderedDependencies, pathFragment }) {
  return {
    dependencies: ['targetPath', renderedDependencies],
    action({ [renderedDependencies]: rendered }) {
      return rendered.map(({ content, filename }) => {
        const path = pathFragment ? `${pathFragment}/${filename}` : filename;
        return writeFile(new URL(path, targetPath), content);
      });
    }
  };
}

function writeRendered(renderedName, path) {
  return {
    dependencies: ['targetPath', renderedName],
    action(config) {
      return writeFile(new URL(path, targetPath), config[renderedName]);
    }
  };
}

async function copyStaticDirectory(sourceDirectory, targetDirectory, allowedFileEndings) {
  await cp(sourceDirectory, targetDirectory, {
    filter(src) {
      return pathToFileURL(src).pathname === sourceDirectory.pathname || allowedFileEndings.includes(extname(src));
    },
    recursive: true
  });

  return ExecutionGraph.createWatchableResult({ path: sourceDirectory, result: targetDirectory });
}

async function makeDirectory(path) {
  const directory = new URL(path, targetPath);

  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });

  return directory;
}

function makeDirectoryNode(path, watchPath) {
  return {
    dependencies: ['targetPath'],
    async action() {
      const result = await makeDirectory(path);

      return watchPath ? ExecutionGraph.createWatchableResult({ path: watchPath, result }) : result;
    }
  };
}

// This is where it all kicks off. This function loads posts and templates,
// renders it all to files, and saves them to the public directory.
export async function build({ baseUrl, baseTitle, repoUrl, dev }) {
  let watcher = null;

  if (dev) {
    const { watch } = await import('chokidar');
    watcher = watch([fileURLToPath(sourcePath), fileURLToPath(contentPath)]);
    await once(watcher, 'ready');
  }

  const graph = new ExecutionGraph({ watcher });

  await graph.addNodes({
    async targetPath() {
      await rm(targetPath, { recursive: true, force: true });
      await mkdir(targetPath);
    },
    commitTime() {
      return getLastCommitTime(contentPath);
    },
    async templates() {
      const path = new URL('templates/', sourcePath);
      const result = await loadTemplates(path, { baseTitle });

      return ExecutionGraph.createWatchableResult({ path, result });
    },
    async feeds() {
      const feedsPath = new URL('feeds.json', contentPath);
      const json = await readFile(feedsPath, 'utf8');

      return ExecutionGraph.createWatchableResult({
        path: feedsPath,
        result: JSON.parse(json)
      });
    },
    async publications() {
      const publicationsPath = new URL('publications.json', contentPath);
      const json = await readFile(publicationsPath, 'utf8');

      return ExecutionGraph.createWatchableResult({
        path: publicationsPath,
        result: JSON.parse(json)
      });
    },
    specialFiles: {
      dependencies: ['extraCss', 'hashedScripts'],
      async action({ extraCss, hashedScripts }) {
        const specialPath = new URL('special/', contentPath);

        return ExecutionGraph.createWatchableResult({
          path: specialPath,
          result: await loadPostFiles({ path: specialPath, basePath, repoUrl, baseUrl, extraCss, hashedScripts, type: null })
        });
      }
    },
    postFiles: {
      dependencies: ['extraCss', 'mathStyles', 'codeStyle', 'hashedScripts'],
      async action({ extraCss, mathStyles, codeStyle, hashedScripts }) {
        const postsPath = new URL('posts/', contentPath);
        const joinedStyles = new Map([...extraCss, ...mathStyles, ...codeStyle]);

        return ExecutionGraph.createWatchableResult({
          path: postsPath,
          result: await loadPostFiles({ path: postsPath, basePath, repoUrl, baseUrl, extraCss: joinedStyles, hashedScripts, type: 'blog' })
        });
      }
    },
    populateHeaders: {
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
    },
    japaneseNotesFiles: {
      dependencies: ['hashedScripts'],
      async action({ hashedScripts }) {
        const notesPath = new URL('japanese-notes/', contentPath);
        const type = 'japanese-notes';

        return ExecutionGraph.createWatchableResult({
          path: notesPath,
          result: await loadPostFiles({ path: notesPath, basePath, repoUrl, baseUrl, type, hashedScripts })
        });
      }
    },
    noteFiles: {
      dependencies: ['images'],
      async action({ images: imagesDimensions }) {
        const dir = new URL('notes/', contentPath);
        const imagesDir = new URL('images/', contentPath);

        return ExecutionGraph.createWatchableResult({
          path: dir,
          result: await loadNoteFiles({ baseUrl, dir, imagesDir, imagesDimensions })
        });
      }
    },
    async studySessionFiles() {
      const dir = new URL('study-sessions/', contentPath);

      return ExecutionGraph.createWatchableResult({
        path: dir,
        result: await loadStudySessionsFiles({ baseUrl, dir })
      });
    },
    async linkFiles() {
      const dir = new URL('links/', contentPath);

      return ExecutionGraph.createWatchableResult({
        path: dir,
        result: await loadLinkFiles({ baseUrl, dir })
      });
    },
    async likeFiles() {
      const dir = new URL('likes/', contentPath);

      return ExecutionGraph.createWatchableResult({
        path: dir,
        result: await loadLikeFiles({ baseUrl, dir })
      });
    },
    async replyFiles() {
      const dir = new URL('replies/', contentPath);

      return ExecutionGraph.createWatchableResult({
        path: dir,
        result: await loadReplyFiles({ baseUrl, dir })
      });
    },
    stylesDirectory: makeDirectoryNode('styles/'),
    blogDirectory: makeDirectoryNode('blog/'),
    japaneseNotesDirectory: makeDirectoryNode('japanese-notes/'),
    notesDirectory: makeDirectoryNode('notes/'),
    studySessionsDirectory: makeDirectoryNode('study-sessions/'),
    linksDirectory: makeDirectoryNode('links/'),
    likesDirectory: makeDirectoryNode('likes/'),
    repliesDirectory: makeDirectoryNode('replies/'),
    tagsDirectory: makeDirectoryNode('tags/'),
    imagesTarget: makeDirectoryNode('images/', new URL('images/', sourcePath)),
    activitypubDocuments: {
      dependencies: ['targetPath'],
      action() {
        const sourceDirectory = new URL('activitypub/', sourcePath);
        const targetDirectory = new URL('activitypub/', targetPath);

        return copyStaticDirectory(sourceDirectory, targetDirectory, ['.json']);
      }
    },
    fingerTarget: {
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
    },
    icons: {
      dependencies: ['targetPath'],
      action() {
        const sourceDirectory = new URL('icons/', sourcePath);
        const targetDirectory = new URL('icons/', targetPath);

        return copyStaticDirectory(sourceDirectory, targetDirectory, ['.png', '.svg']);
      }
    },
    img: {
      dependencies: ['targetPath'],
      action() {
        const sourceDirectory = new URL('img/', sourcePath);
        const targetDirectory = new URL('img/', targetPath);

        return copyStaticDirectory(sourceDirectory, targetDirectory, ['.jpg', '.jpeg', '.webp', '.avif']);
      }
    },
    scripts: {
      dependencies: ['targetPath'],
      action() {
        const sourceDirectory = new URL('scripts/', contentPath);
        const targetDirectory = new URL('scripts/', targetPath);

        return copyStaticDirectory(sourceDirectory, targetDirectory, ['.js']);
      }
    },
    hashedScripts: {
      dependencies: ['targetPath', 'scripts'],
      async action({ scripts }) {
        const path = new URL('scripts/', contentPath);
        const items = (await readdir(path)).filter(i => i.endsWith('.js'));
        const entries = await Promise.all(items.map(item => hashCopy(targetPath, new URL(item, path), scripts)));
        const result = Object.fromEntries(entries);

        return ExecutionGraph.createWatchableResult({ path, result });
      }
    },
    papers: {
      dependencies: ['targetPath'],
      action() {
        const sourceDirectory = new URL('papers/', contentPath);
        const targetDirectory = new URL('papers/', targetPath);

        return copyStaticDirectory(sourceDirectory, targetDirectory, ['.pdf']);
      }
    },
    images: {
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
    },
    googleSiteVerification: {
      dependencies: ['targetPath'],
      action() {
        const name = 'google91826e4f943d9ee9.html';
        return writeFile(new URL(name, targetPath), `google-site-verification: ${name}\n`);
      }
    },
    keybaseVerification: {
      dependencies: ['targetPath'],
      async action() {
        const verificationPath = new URL('keybase.txt', sourcePath);

        await copyFile(verificationPath, new URL('keybase.txt', targetPath));

        return ExecutionGraph.createWatchableResult({
          path: verificationPath,
          result: null
        });
      }
    },
    robotsFile: {
      dependencies: ['targetPath'],
      async action() {
        const robotsPath = new URL('robots.txt', sourcePath);

        await copyFile(robotsPath, new URL('robots.txt', targetPath));

        return ExecutionGraph.createWatchableResult({
          path: robotsPath,
          result: null
        });
      }
    },
    css: {
      dependencies: ['targetPath'],
      async action() {
        const { url, htmlPath } = await generateMainCss({
          entry: new URL('css/entry.css', sourcePath),
          targetDirectory: targetPath
        });

        return ExecutionGraph.createWatchableResult({
          path: new URL('css/', sourcePath),
          result: { url, cssPath: htmlPath }
        });
      },
      onRemove() {
        return unlink(this.result.url);
      }
    },
    extraCss: {
      dependencies: ['stylesDirectory'],
      async action({ stylesDirectory }) {
        const cssPath = new URL('styles/', contentPath);

        return ExecutionGraph.createWatchableResult({
          path: cssPath,
          result: await generateSpecificCss(cssPath, stylesDirectory)
        });
      }
    },
    mathsFontName: {
      dependencies: ['stylesDirectory'],
      async action({ stylesDirectory }) {
        const readWoff = await readFile(new URL('node_modules/temml/dist/Temml.woff2', basePath));
        const woffHash = createHash('md5')
          .update(readWoff)
          .digest('hex');
        const hashedWoffName = `hashed-temml-${woffHash}.woff2`;
        const path = new URL(hashedWoffName, stylesDirectory);

        await writeFile(path, readWoff);

        return ExecutionGraph.createWatchableResult({
          path,
          result: { woffName: hashedWoffName, url: path }
        });
      },
      onRemove() {
        return unlink(this.result.url);
      }
    },
    mathStyles: {
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

        return ExecutionGraph.createWatchableResult({
          path: cssPath,
          result: new Map([['/styles/temml.css', `/styles/${hashedCssName}`]])
        });
      },
      onRemove() {
        // todo
      }
    },
    codeStyle: {
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
    },
    collatedTags: {
      dependencies: ['css', 'templates', 'postFiles'],
      action({ postFiles: posts, css: { cssPath }, templates: { tag: template } }) {
        return collateTags({ posts, cssPath, baseUrl, dev, template });
      }
    },
    backlinks: {
      dependencies: ['japaneseNotesFiles', 'postFiles', 'specialFiles'],
      action({ japaneseNotesFiles, postFiles, specialFiles }) {
        return buildBacklinks([...japaneseNotesFiles, ...postFiles, ...specialFiles]);
      }
    },
    renderedShortlinks: {
      dependencies: ['templates', 'postFiles'],
      action({ postFiles, templates }) {
        return templates.shortlinks({ name: 'shortlinks', items: postFiles, baseUrl });
      }
    },
    renderedSpecials: {
      dependencies: ['css', 'templates', 'specialFiles', 'backlinks'],
      action({ specialFiles: resources, backlinks, templates: { blog: template }, css: { cssPath } }) {
        return renderResources({ resources, backlinks, template, cssPath, baseUrl, dev });
      }
    },
    renderedPosts: {
      dependencies: ['css', 'templates', 'postFiles', 'backlinks'],
      action({ postFiles: resources, backlinks, templates: { blog: template }, css: { cssPath } }) {
        return renderResources({ resources, backlinks, template, cssPath, baseUrl, dev });
      }
    },
    renderedJapaneseNotes: {
      dependencies: ['css', 'templates', 'japaneseNotesFiles', 'backlinks'],
      action({ japaneseNotesFiles: resources, backlinks, templates: { blog: template }, css: { cssPath } }) {
        return renderResources({ noIndex: true, resources, backlinks, template, cssPath, baseUrl, dev });
      }
    },
    renderedNotes: {
      dependencies: ['css', 'templates', 'noteFiles'],
      action({ noteFiles: resources, templates: { note: template }, css: { cssPath } }) {
        return renderResources({ noIndex: true, resources, template, cssPath, baseUrl, dev });
      }
    },
    renderedStudySessions: {
      dependencies: ['css', 'templates', 'studySessionFiles'],
      action({ studySessionFiles: resources, templates: { 'study-session': template }, css: { cssPath } }) {
        return renderResources({ noIndex: true, resources, template, cssPath, baseUrl, dev });
      }
    },
    renderedLinks: {
      dependencies: ['css', 'templates', 'linkFiles'],
      action({ linkFiles: resources, templates: { link: template }, css: { cssPath } }) {
        return renderResources({ resources, template, cssPath, baseUrl, dev });
      }
    },
    renderedLikes: {
      dependencies: ['css', 'templates', 'likeFiles'],
      action({ likeFiles: resources, templates: { like: template }, css: { cssPath } }) {
        return renderResources({ resources, template, cssPath, baseUrl, dev });
      }
    },
    renderedReplies: {
      dependencies: ['css', 'templates', 'replyFiles'],
      action({ replyFiles: resources, templates: { reply: template }, css: { cssPath } }) {
        return renderResources({ resources, template, cssPath, baseUrl, dev });
      }
    },
    renderedBlogIndex: {
      dependencies: ['css', 'templates', 'postFiles'],
      action({ postFiles: posts, templates, css: { cssPath } }) {
        return templates.blogs({
          blurb: 'This is a collection of my blog posts. If you use a feed reader, <a href="/blog.atom.xml">you can subscribe</a>!',
          posts: posts.map(p => ({ ...p, hasRuby: false })),
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
          title: 'Japanese Study Notes'
        });
      }
    },
    renderedNotesIndex: {
      dependencies: ['css', 'templates', 'noteFiles'],
      action({ noteFiles: notes, templates, css: { cssPath } }) {
        return templates.notes({
          noIndex: true,
          notes,
          cssPath,
          dev,
          baseUrl,
          localUrl: '/notes',
          title: 'Notes'
        });
      }
    },
    renderedStudySessionsIndex: {
      dependencies: ['css', 'templates', 'studySessionFiles'],
      action({ studySessionFiles: studySessions, templates, css: { cssPath } }) {
        return templates['study-sessions']({
          noIndex: true,
          studySessions,
          cssPath,
          dev,
          baseUrl,
          localUrl: '/study-sessions',
          title: 'Study Sessions'
        });
      }
    },
    renderedLinksIndex: {
      dependencies: ['css', 'templates', 'linkFiles'],
      action({ linkFiles: links, templates, css: { cssPath } }) {
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
      action({ likeFiles: likes, templates, css: { cssPath } }) {
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
      action({ replyFiles: replies, templates, css: { cssPath } }) {
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
    },
    renderedPublications: {
      dependencies: ['css', 'templates', 'publications'],
      action({ templates, css: { cssPath }, publications }) {
        return templates.publications({
          cssPath,
          dev,
          baseUrl,
          localUrl: '/publications',
          publications,
          title: 'Publications'
        });
      }
    },
    renderedFourOhFour: {
      dependencies: ['css', 'templates'],
      action({ templates, css: { cssPath } }) {
        return templates[404]({ cssPath, dev, baseUrl, localUrl: '/404', title: 'Not Found' });
      }
    },
    renderedWebmentionConfirmation: {
      dependencies: ['css', 'templates'],
      action({ templates, css: { cssPath } }) {
        return templates.webmention({ cssPath, dev, baseUrl, localUrl: '/webmention', title: 'Webmention' });
      }
    },
    renderedSitemap: {
      dependencies: ['templates', 'collatedTags', 'specialFiles', 'postFiles'],
      action({ templates, collatedTags, specialFiles, postFiles }) {
        const pages = [...specialFiles, ...postFiles];
        return templates.sitemap({ tags: collatedTags, pages, baseUrl });
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
    writtenIndex: writeRendered('renderedAbout', 'index.html'),
    writtenBlogIndex: writeRendered('renderedBlogIndex', 'blog/index.html'),
    writtenJapaneseNotesIndex: writeRendered('renderedJapaneseNotesIndex', 'japanese-notes/index.html'),
    writtenNotesIndex: writeRendered('renderedNotesIndex', 'notes/index.html'),
    writtenStudySessionsIndex: writeRendered('renderedStudySessionsIndex', 'study-sessions/index.html'),
    writtenLinksIndex: writeRendered('renderedLinksIndex', 'links/index.html'),
    writtenLikesIndex: writeRendered('renderedLikesIndex', 'likes/index.html'),
    writtenRepliesIndex: writeRendered('renderedRepliesIndex', 'replies/index.html'),
    writtenPublications: writeRendered('renderedPublications', 'publications.html'),
    writtenWebmentionConfirmation: writeRendered('renderedWebmentionConfirmation', 'webmention.html'),
    writtenFourOhFour: writeRendered('renderedFourOhFour', '404.html'),
    writtenSitemap: writeRendered('renderedSitemap', 'sitemap.txt'),
    writtenShortlinks: writeRendered('renderedShortlinks', 'shortlinks.txt'),
    writtenAtomFeeds: {
      dependencies: ['targetPath', 'renderedAtomFeeds'],
      action({ renderedAtomFeeds: { all, posts, social } }) {
        return Promise.all([
          writeFile(new URL('atom.xml', targetPath), all),
          writeFile(new URL('blog.atom.xml', targetPath), posts),
          writeFile(new URL('social.atom.xml', targetPath), social)
        ]);
      }
    },
    writtenOpml: {
      dependencies: ['targetPath', 'templates', 'feeds'],
      action({ templates, feeds }) {
        return writeFile(new URL('feeds.opml', targetPath), templates.feeds({ feeds }));
      }
    },
    writtenBlogroll: {
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
    },
    writtenSpecials: makeWriteEntries({ renderedDependencies: 'renderedSpecials', pathFragment: null }),
    writtenPosts: makeWriteEntries({ renderedDependencies: 'renderedPosts', pathFragment: 'blog' }),
    writtenJapaneseNotes: makeWriteEntries({ renderedDependencies: 'renderedJapaneseNotes', pathFragment: 'japanese-notes' }),
    writtenNotes: makeWriteEntries({ renderedDependencies: 'renderedNotes', pathFragment: 'notes' }),
    writtenStudySessions: makeWriteEntries({ renderedDependencies: 'renderedStudySessions', pathFragment: 'study-sessions' }),
    writtenLinks: makeWriteEntries({ renderedDependencies: 'renderedLinks', pathFragment: 'links' }),
    writtenLikes: makeWriteEntries({ renderedDependencies: 'renderedLikes', pathFragment: 'likes' }),
    writtenReplies: makeWriteEntries({ renderedDependencies: 'renderedReplies', pathFragment: 'replies' }),
    writtenTags: makeWriteEntries({ renderedDependencies: 'collatedTags', pathFragment: 'tags' }),
    lastBuild: {
      dependencies: ['targetPath', 'writtenSitemap'],
      action() {
        return writeFile(new URL('last-build.txt', targetPath), `${new Date().toISOString()}\n`);
      }
    }
  });

  return graph;
}

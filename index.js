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

function renderResources({ noIndex, resources, template, cssPath, baseUrl, backlinks = {}, dev }) {
  return resources.map(resource => ({
    html: template({ ...resource, noIndex, cssPath, baseUrl, backlinks: backlinks[resource.localUrl], dev }),
    filename: resource.filename
  }));
}

function makeWriteEntries({ renderedDependencies, pathFragment }) {
  return {
    dependencies: ['paths', renderedDependencies],
    action({ paths: { target }, [renderedDependencies]: rendered }) {
      return rendered.map(({ html, filename }) => writeFile(new URL(`${pathFragment}/${filename}`, target), html));
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

const basePath = new URL('./', import.meta.url);
const sourcePath = new URL('./src/', import.meta.url);
const contentPath = new URL('./content/', import.meta.url);
const targetPath = new URL('./public/', import.meta.url);

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
    paths: {
      async action() {
        await rm(targetPath, { recursive: true, force: true });
        await mkdir(targetPath);

        return {
          base: basePath,
          source: sourcePath,
          target: targetPath,
          content: contentPath,
          async makeDirectory(path) {
            const directory = new URL(path, targetPath);

            await rm(directory, { recursive: true, force: true });
            await mkdir(directory, { recursive: true });

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
        const path = new URL('templates/', source);
        const result = await loadTemplates(path, { baseTitle });

        return ExecutionGraph.createWatchableResult({ path, result });
      }
    },
    feeds: {
      dependencies: ['paths'],
      async action({ paths: { content } }) {
        const feedsPath = new URL('feeds.json', content);
        const json = await readFile(feedsPath, 'utf8');

        return ExecutionGraph.createWatchableResult({
          path: feedsPath,
          result: JSON.parse(json)
        });
      }
    },
    publications: {
      dependencies: ['paths'],
      async action({ paths: { content } }) {
        const publicationsPath = new URL('publications.json', content);
        const json = await readFile(publicationsPath, 'utf8');

        return ExecutionGraph.createWatchableResult({
          path: publicationsPath,
          result: JSON.parse(json)
        });
      }
    },
    postFiles: {
      dependencies: ['paths', 'extraCss', 'hashedScripts'],
      async action({ paths: { base, content }, extraCss, hashedScripts }) {
        const postsPath = new URL('posts/', content);

        return ExecutionGraph.createWatchableResult({
          path: postsPath,
          result: await loadPostFiles({ path: postsPath, basePath: base, repoUrl, baseUrl, extraCss, hashedScripts })
        });
      }
    },
    populateHeaders: {
      dependencies: ['paths', 'postFiles'],
      action({ paths: { target }, postFiles }) {
        const headers = new NetlifyHeaders();

        for (const post of postFiles) {
          if (post.importMap) {
            const hash = createHash('sha256')
              .update(post.importMap)
              .digest('base64');

            headers.addHeaders(post.localUrl, [
              [
                'Content-Security-Policy',
                `default-src 'self'; script-src 'sha256-${hash}' 'self'; style-src 'self'; img-src *; child-src https://www.youtube-nocookie.com 'self'; frame-src https://www.youtube-nocookie.com 'self';` // eslint-disable-line max-len
              ]
            ]);

            writeFile(new URL('_headers', target), `${headers.generate()}\n`);
          }
        }
      }
    },
    japaneseNotesFiles: {
      dependencies: ['paths', 'hashedScripts'],
      async action({ paths: { base, content }, hashedScripts }) {
        const notesPath = new URL('japanese-notes/', content);
        const type = 'japanese-notes';

        return ExecutionGraph.createWatchableResult({
          path: notesPath,
          result: await loadPostFiles({ path: notesPath, basePath: base, repoUrl, baseUrl, type, hashedScripts })
        });
      }
    },
    noteFiles: {
      dependencies: ['paths', 'images'],
      async action({ paths: { content }, images: imagesDimensions }) {
        const dir = new URL('notes/', content);
        const imagesDir = new URL('images/', content);

        return ExecutionGraph.createWatchableResult({
          path: dir,
          result: await loadNoteFiles({ dir, imagesDir, imagesDimensions })
        });
      }
    },
    studySessionFiles: {
      dependencies: ['paths'],
      async action({ paths: { content } }) {
        const studySessionsPath = new URL('study-sessions/', content);

        return ExecutionGraph.createWatchableResult({
          path: studySessionsPath,
          result: await loadStudySessionsFiles(studySessionsPath)
        });
      }
    },
    linkFiles: {
      dependencies: ['paths'],
      async action({ paths: { content } }) {
        const linksPath = new URL('links/', content);

        return ExecutionGraph.createWatchableResult({
          path: linksPath,
          result: await loadLinkFiles(linksPath)
        });
      }
    },
    likeFiles: {
      dependencies: ['paths'],
      async action({ paths: { content } }) {
        const likesPath = new URL('likes/', content);

        return ExecutionGraph.createWatchableResult({
          path: likesPath,
          result: await loadLikeFiles(likesPath)
        });
      }
    },
    replyFiles: {
      dependencies: ['paths'],
      async action({ paths: { content } }) {
        const repliesPath = new URL('replies/', content);

        return ExecutionGraph.createWatchableResult({
          path: repliesPath,
          result: await loadReplyFiles(repliesPath)
        });
      }
    },
    stylesDirectory: {
      dependencies: ['paths'],
      action({ paths: { makeDirectory } }) {
        return makeDirectory('styles/');
      }
    },
    blogDirectory: {
      dependencies: ['paths'],
      action({ paths: { makeDirectory } }) {
        return makeDirectory('blog/');
      }
    },
    japaneseNotesDirectory: {
      dependencies: ['paths'],
      action({ paths: { makeDirectory } }) {
        return makeDirectory('japanese-notes/');
      }
    },
    notesDirectory: {
      dependencies: ['paths'],
      action({ paths: { makeDirectory } }) {
        return makeDirectory('notes/');
      }
    },
    studySessionsDirectory: {
      dependencies: ['paths'],
      action({ paths: { makeDirectory } }) {
        return makeDirectory('study-sessions/');
      }
    },
    linksDirectory: {
      dependencies: ['paths'],
      action({ paths: { makeDirectory } }) {
        return makeDirectory('links/');
      }
    },
    likesDirectory: {
      dependencies: ['paths'],
      action({ paths: { makeDirectory } }) {
        return makeDirectory('likes/');
      }
    },
    repliesDirectory: {
      dependencies: ['paths'],
      action({ paths: { makeDirectory } }) {
        return makeDirectory('replies/');
      }
    },
    tagsDirectory: {
      dependencies: ['paths'],
      action({ paths: { makeDirectory } }) {
        return makeDirectory('tags/');
      }
    },
    activitypubDocuments: {
      dependencies: ['paths'],
      action({ paths: { source, target } }) {
        const sourceDirectory = new URL('activitypub/', source);
        const targetDirectory = new URL('activitypub/', target);

        return copyStaticDirectory(sourceDirectory, targetDirectory, ['.json']);
      }
    },
    fingerTarget: {
      dependencies: ['paths'],
      action({ paths: { makeDirectory } }) {
        return makeDirectory('.well-known/');
      }
    },
    fingerDocument: {
      dependencies: ['fingerTarget'],
      action({ fingerTarget }) {
        return writeFile(new URL('webfinger', fingerTarget), JSON.stringify({
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
      dependencies: ['paths'],
      action({ paths: { source, target } }) {
        const sourceDirectory = new URL('icons/', source);
        const targetDirectory = new URL('icons/', target);

        return copyStaticDirectory(sourceDirectory, targetDirectory, ['.png', '.svg']);
      }
    },
    img: {
      dependencies: ['paths'],
      action({ paths: { source, target } }) {
        const sourceDirectory = new URL('img/', source);
        const targetDirectory = new URL('img/', target);

        return copyStaticDirectory(sourceDirectory, targetDirectory, ['.jpeg', '.webp', '.avif']);
      }
    },
    scripts: {
      dependencies: ['paths'],
      action({ paths: { content, target } }) {
        const sourceDirectory = new URL('scripts/', content);
        const targetDirectory = new URL('scripts/', target);

        return copyStaticDirectory(sourceDirectory, targetDirectory, ['.js']);
      }
    },
    hashedScripts: {
      dependencies: ['paths', 'scripts'],
      async action({ paths: { content, target }, scripts }) {
        const path = new URL('scripts/', content);
        const items = (await readdir(path)).filter(i => i.endsWith('.js'));
        const entries = await Promise.all(items.map(item => hashCopy(target, new URL(item, path), scripts)));
        const result = Object.fromEntries(entries);

        return ExecutionGraph.createWatchableResult({ path, result });
      }
    },
    papers: {
      dependencies: ['paths'],
      action({ paths: { content, target } }) {
        const sourceDirectory = new URL('papers/', content);
        const targetDirectory = new URL('papers/', target);

        return copyStaticDirectory(sourceDirectory, targetDirectory, ['.pdf']);
      }
    },
    imagesTarget: {
      dependencies: ['paths'],
      async action({ paths: { source, makeDirectory } }) {
        return ExecutionGraph.createWatchableResult({
          path: new URL('images/', source),
          result: await makeDirectory('images/')
        });
      }
    },
    images: {
      dependencies: ['paths', 'imagesTarget'],
      async action({ paths: { content }, imagesTarget }) {
        const directory = new URL('images/', content);
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
      dependencies: ['paths'],
      action({ paths: { target } }) {
        const name = 'google91826e4f943d9ee9.html';
        return writeFile(new URL(name, target), `google-site-verification: ${name}\n`);
      }
    },
    keybaseVerification: {
      dependencies: ['paths'],
      async action({ paths: { source, target } }) {
        const verificationPath = new URL('keybase.txt', source);

        await copyFile(verificationPath, new URL('keybase.txt', target));

        return ExecutionGraph.createWatchableResult({
          path: verificationPath,
          result: null
        });
      }
    },
    robotsFile: {
      dependencies: ['paths'],
      async action({ paths: { source, target } }) {
        const robotsPath = new URL('robots.txt', source);

        await copyFile(robotsPath, new URL('robots.txt', target));

        return ExecutionGraph.createWatchableResult({
          path: robotsPath,
          result: null
        });
      }
    },
    css: {
      dependencies: ['paths'],
      async action({ paths: { source, target } }) {
        const { url, htmlPath } = await generateMainCss({
          entry: new URL('css/entry.css', source),
          targetDirectory: target,
          codeStyle: 'default'
        });

        return ExecutionGraph.createWatchableResult({
          path: new URL('css/', source),
          result: { url, htmlPath }
        });
      },
      onRemove() {
        return unlink(this.result.url);
      }
    },
    extraCss: {
      dependencies: ['paths', 'stylesDirectory'],
      async action({ paths: { content }, stylesDirectory }) {
        const cssPath = new URL('styles/', content);

        return ExecutionGraph.createWatchableResult({
          path: cssPath,
          result: await generateSpecificCss(cssPath, stylesDirectory)
        });
      }
    },
    collatedTags: {
      dependencies: ['css', 'templates', 'postFiles'],
      action({ postFiles: posts, css: { htmlPath: cssPath }, templates: { tag: template } }) {
        return collateTags({ posts, cssPath, baseUrl, dev, template });
      }
    },
    backlinks: {
      dependencies: ['japaneseNotesFiles', 'postFiles'],
      action({ japaneseNotesFiles, postFiles }) {
        return buildBacklinks([...japaneseNotesFiles, ...postFiles]);
      }
    },
    renderedShortlinks: {
      dependencies: ['templates', 'postFiles'],
      action({ postFiles, templates }) {
        return templates.shortlinks({ name: 'shortlinks', items: postFiles, baseUrl });
      }
    },
    renderedPosts: {
      dependencies: ['css', 'templates', 'postFiles', 'backlinks'],
      action({ postFiles: resources, backlinks, templates: { blog: template }, css: { htmlPath: cssPath } }) {
        return renderResources({ resources, backlinks, template, cssPath, baseUrl, dev });
      }
    },
    renderedJapaneseNotes: {
      dependencies: ['css', 'templates', 'japaneseNotesFiles', 'backlinks'],
      action({ japaneseNotesFiles: resources, backlinks, templates: { blog: template }, css: { htmlPath: cssPath } }) {
        return renderResources({ noIndex: true, resources, backlinks, template, cssPath, baseUrl, dev });
      }
    },
    renderedNotes: {
      dependencies: ['css', 'templates', 'noteFiles'],
      action({ noteFiles: resources, templates: { note: template }, css: { htmlPath: cssPath } }) {
        return renderResources({ noIndex: true, resources, template, cssPath, baseUrl, dev });
      }
    },
    renderedStudySessions: {
      dependencies: ['css', 'templates', 'studySessionFiles'],
      action({ studySessionFiles: resources, templates: { 'study-session': template }, css: { htmlPath: cssPath } }) {
        return renderResources({ noIndex: true, resources, template, cssPath, baseUrl, dev });
      }
    },
    renderedLinks: {
      dependencies: ['css', 'templates', 'linkFiles'],
      action({ linkFiles: resources, templates: { link: template }, css: { htmlPath: cssPath } }) {
        return renderResources({ resources, template, cssPath, baseUrl, dev });
      }
    },
    renderedLikes: {
      dependencies: ['css', 'templates', 'likeFiles'],
      action({ likeFiles: resources, templates: { like: template }, css: { htmlPath: cssPath } }) {
        return renderResources({ resources, template, cssPath, baseUrl, dev });
      }
    },
    renderedReplies: {
      dependencies: ['css', 'templates', 'replyFiles'],
      action({ replyFiles: resources, templates: { reply: template }, css: { htmlPath: cssPath } }) {
        return renderResources({ resources, template, cssPath, baseUrl, dev });
      }
    },
    renderedBlogIndex: {
      dependencies: ['css', 'templates', 'postFiles'],
      action({ postFiles: posts, templates, css: { htmlPath: cssPath } }) {
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
      action({ japaneseNotesFiles: posts, templates, css: { htmlPath: cssPath } }) {
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
      action({ noteFiles: notes, templates, css: { htmlPath: cssPath } }) {
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
      action({ studySessionFiles: studySessions, templates, css: { htmlPath: cssPath } }) {
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
      action({ linkFiles: links, templates, css: { htmlPath: cssPath } }) {
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
      action({ likeFiles: likes, templates, css: { htmlPath: cssPath } }) {
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
      action({ replyFiles: replies, templates, css: { htmlPath: cssPath } }) {
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
      action({ templates, css: { htmlPath: cssPath } }) {
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
      action({ templates, css: { htmlPath: cssPath }, publications }) {
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
      action({ templates, css: { htmlPath: cssPath } }) {
        return templates[404]({ cssPath, dev, baseUrl, localUrl: '/404', title: 'Not Found' });
      }
    },
    renderedWebmentionConfirmation: {
      dependencies: ['css', 'templates'],
      action({ templates, css: { htmlPath: cssPath } }) {
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
        return writeFile(new URL('index.html', target), renderedAbout);
      }
    },
    writtenBlogIndex: {
      dependencies: ['paths', 'renderedBlogIndex'],
      action({ paths: { target }, renderedBlogIndex }) {
        return writeFile(new URL('blog/index.html', target), renderedBlogIndex);
      }
    },
    writtenJapaneseNotesIndex: {
      dependencies: ['paths', 'renderedJapaneseNotesIndex'],
      action({ paths: { target }, renderedJapaneseNotesIndex }) {
        return writeFile(new URL('japanese-notes/index.html', target), renderedJapaneseNotesIndex);
      }
    },
    writtenNotesIndex: {
      dependencies: ['paths', 'renderedNotesIndex'],
      action({ paths: { target }, renderedNotesIndex }) {
        return writeFile(new URL('notes/index.html', target), renderedNotesIndex);
      }
    },
    writtenStudySessionsIndex: {
      dependencies: ['paths', 'renderedStudySessionsIndex'],
      action({ paths: { target }, renderedStudySessionsIndex }) {
        return writeFile(new URL('study-sessions/index.html', target), renderedStudySessionsIndex);
      }
    },
    writtenLinksIndex: {
      dependencies: ['paths', 'renderedLinksIndex'],
      action({ paths: { target }, renderedLinksIndex }) {
        return writeFile(new URL('links/index.html', target), renderedLinksIndex);
      }
    },
    writtenLikesIndex: {
      dependencies: ['paths', 'renderedLikesIndex'],
      action({ paths: { target }, renderedLikesIndex }) {
        return writeFile(new URL('likes/index.html', target), renderedLikesIndex);
      }
    },
    writtenRepliesIndex: {
      dependencies: ['paths', 'renderedRepliesIndex'],
      action({ paths: { target }, renderedRepliesIndex }) {
        return writeFile(new URL('replies/index.html', target), renderedRepliesIndex);
      }
    },
    writtenPublications: {
      dependencies: ['paths', 'renderedPublications'],
      action({ paths: { target }, renderedPublications }) {
        return writeFile(new URL('publications.html', target), renderedPublications);
      }
    },
    writtenWebmentionConfirmation: {
      dependencies: ['paths', 'renderedWebmentionConfirmation'],
      action({ paths: { target }, renderedWebmentionConfirmation }) {
        return writeFile(new URL('webmention.html', target), renderedWebmentionConfirmation);
      }
    },
    writtenFourOhFour: {
      dependencies: ['paths', 'renderedFourOhFour'],
      action({ paths: { target }, renderedFourOhFour }) {
        return writeFile(new URL('404.html', target), renderedFourOhFour);
      }
    },
    writtenSitemap: {
      dependencies: ['paths', 'renderedSitemap'],
      action({ paths: { target }, renderedSitemap }) {
        return writeFile(new URL('sitemap.txt', target), renderedSitemap);
      }
    },
    writtenShortlinks: {
      dependencies: ['paths', 'renderedShortlinks'],
      action({ paths: { target }, renderedShortlinks }) {
        return writeFile(new URL('shortlinks.txt', target), renderedShortlinks);
      }
    },
    writtenAtomFeeds: {
      dependencies: ['paths', 'renderedAtomFeeds'],
      action({ paths: { target }, renderedAtomFeeds: { all, posts, social } }) {
        return Promise.all([
          writeFile(new URL('atom.xml', target), all),
          writeFile(new URL('blog.atom.xml', target), posts),
          writeFile(new URL('social.atom.xml', target), social)
        ]);
      }
    },
    writtenOpml: {
      dependencies: ['paths', 'templates', 'feeds'],
      action({ paths: { target }, templates, feeds }) {
        return writeFile(new URL('feeds.opml', target), templates.feeds({ feeds }));
      }
    },
    writtenBlogroll: {
      dependencies: ['css', 'paths', 'templates', 'feeds'],
      action({ css: { htmlPath: cssPath }, paths: { target }, templates, feeds }) {
        return writeFile(new URL('blogroll.html', target), templates.blogroll({
          feeds,
          cssPath,
          dev,
          baseUrl,
          localUrl: '/blogroll',
          title: 'Blogroll'
        }));
      }
    },
    writtenPosts: makeWriteEntries({ renderedDependencies: 'renderedPosts', pathFragment: 'blog' }),
    writtenJapaneseNotes: makeWriteEntries({ renderedDependencies: 'renderedJapaneseNotes', pathFragment: 'japanese-notes' }),
    writtenNotes: makeWriteEntries({ renderedDependencies: 'renderedNotes', pathFragment: 'notes' }),
    writtenStudySessions: makeWriteEntries({ renderedDependencies: 'renderedStudySessions', pathFragment: 'study-sessions' }),
    writtenLinks: makeWriteEntries({ renderedDependencies: 'renderedLinks', pathFragment: 'links' }),
    writtenLikes: makeWriteEntries({ renderedDependencies: 'renderedLikes', pathFragment: 'likes' }),
    writtenReplies: makeWriteEntries({ renderedDependencies: 'renderedReplies', pathFragment: 'replies' }),
    writtenTags: makeWriteEntries({ renderedDependencies: 'collatedTags', pathFragment: 'tags' }),
    lastBuild: {
      dependencies: ['paths', 'writtenSitemap'],
      action({ paths: { target } }) {
        return writeFile(new URL('last-build.txt', target), `${new Date().toISOString()}\n`);
      }
    }
  });

  return graph;
}

/* eslint max-lines: off */

import { fileURLToPath } from 'node:url';
import { readdir, writeFile, rm, mkdir, readFile, copyFile, unlink } from 'node:fs/promises';
import { once } from 'node:events';

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

function renderResources({ resources, template, cssPath, baseUrl, backlinks = {}, dev }) {
  return resources.map(resource => ({
    html: template({ ...resource, cssPath, baseUrl, backlinks: backlinks[resource.localUrl], dev }),
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

// This is where it all kicks off. This function loads posts and templates,
// renders it all to files, and saves them to the public directory.
export async function build({ baseUrl, baseTitle, dev, syndications }) {
  const sourcePath = new URL('./src/', import.meta.url);
  const contentPath = new URL('./content/', import.meta.url);
  const targetPath = new URL('./public/', import.meta.url);

  let watcher = null;

  if (dev) {
    const { watch } = await import('chokidar');
    watcher = watch([fileURLToPath(sourcePath), fileURLToPath(contentPath)]);
    await once(watcher, 'ready');
  }

  const graph = new ExecutionGraph({ watcher });

  // This stores a reference to the exitsing css so it can be cleaned up on
  // change. Eventually I'd like to build this into the execution graph.
  let cssUrl;

  await graph.addNodes({
    paths: {
      async action() {
        await rm(targetPath, { recursive: true, force: true });
        await mkdir(targetPath);

        return {
          source: sourcePath,
          target: targetPath,
          content: contentPath,
          async makeDirectory(path) {
            const directory = new URL(path, targetPath);

            await rm(directory, { recursive: true, force: true });
            await mkdir(directory);

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
        const templatesPath = new URL('templates/', source);
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
      dependencies: ['paths', 'extraCss'],
      async action({ paths: { content }, extraCss }) {
        const postsPath = new URL('posts/', content);

        return ExecutionGraph.createWatchableResult({
          path: postsPath,
          result: await loadPostFiles({ path: postsPath, baseUrl, extraCss })
        });
      }
    },
    japaneseNotesFiles: {
      dependencies: ['paths'],
      async action({ paths: { content } }) {
        const notesPath = new URL('japanese-notes/', content);

        return ExecutionGraph.createWatchableResult({
          path: notesPath,
          result: await loadPostFiles({ path: notesPath, baseUrl, type: 'japanese-notes' })
        });
      }
    },
    noteFiles: {
      dependencies: ['paths', 'images'],
      async action({ paths: { content }, images: imagesDimensions }) {
        const notesPath = new URL('notes/', content);

        return ExecutionGraph.createWatchableResult({
          path: notesPath,
          result: await loadNoteFiles(notesPath, syndications, imagesDimensions)
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
          result: await loadLinkFiles(linksPath, syndications)
        });
      }
    },
    likeFiles: {
      dependencies: ['paths'],
      async action({ paths: { content } }) {
        const likesPath = new URL('likes/', content);

        return ExecutionGraph.createWatchableResult({
          path: likesPath,
          result: await loadLikeFiles(likesPath, syndications)
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
    iconsTarget: {
      dependencies: ['paths'],
      async action({ paths: { source, makeDirectory } }) {
        return ExecutionGraph.createWatchableResult({
          path: new URL('icons/', source),
          result: await makeDirectory('icons/')
        });
      }
    },
    icons: {
      dependencies: ['paths', 'iconsTarget'],
      async action({ paths: { source }, iconsTarget }) {
        const directory = new URL('icons/', source);
        const items = (await readdir(directory)).filter(i => i.endsWith('.png') || i.endsWith('.svg'));

        await Promise.all(
          items.map(
            item => copyFile(
              new URL(item, directory),
              new URL(item, iconsTarget)
            )
          )
        );
      }
    },
    imgTarget: {
      dependencies: ['paths'],
      async action({ paths: { source, makeDirectory } }) {
        return ExecutionGraph.createWatchableResult({
          path: new URL('img/', source),
          result: await makeDirectory('img/')
        });
      }
    },
    img: {
      dependencies: ['paths', 'imgTarget'],
      async action({ paths: { source }, imgTarget }) {
        const directory = new URL('img/', source);
        const items = (await readdir(directory)).filter(i => i.endsWith('.jpg') || i.endsWith('.webp') || i.endsWith('.avif'));

        await Promise.all(
          items.map(
            item => copyFile(
              new URL(item, directory),
              new URL(item, imgTarget)
            )
          )
        );
      }
    },
    scriptsTarget: {
      dependencies: ['paths'],
      async action({ paths: { source, makeDirectory } }) {
        return ExecutionGraph.createWatchableResult({
          path: new URL('scripts/', source),
          result: await makeDirectory('scripts/')
        });
      }
    },
    scripts: {
      dependencies: ['paths', 'scriptsTarget'],
      async action({ paths: { content }, scriptsTarget }) {
        const directory = new URL('scripts/', content);
        const items = (await readdir(directory)).filter(i => i.endsWith('.js'));

        await Promise.all(
          items.map(
            item => copyFile(
              new URL(item, directory),
              new URL(item, scriptsTarget)
            )
          )
        );
      }
    },
    papersTarget: {
      dependencies: ['paths'],
      async action({ paths: { source, makeDirectory } }) {
        return ExecutionGraph.createWatchableResult({
          path: new URL('papers/', source),
          result: await makeDirectory('papers/')
        });
      }
    },
    papers: {
      dependencies: ['paths', 'papersTarget'],
      async action({ paths: { content }, papersTarget }) {
        const directory = new URL('papers/', content);
        const items = (await readdir(directory)).filter(i => i.endsWith('.pdf'));

        await Promise.all(
          items.map(
            item => copyFile(
              new URL(item, directory),
              new URL(item, papersTarget)
            )
          )
        );
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
        const verificationPath = new URL('robots.txt', source);

        await copyFile(verificationPath, new URL('robots.txt', target));

        return ExecutionGraph.createWatchableResult({
          path: verificationPath,
          result: null
        });
      }
    },
    indexJsFile: {
      dependencies: ['paths'],
      async action({ paths: { source, target } }) {
        const indexPath = new URL('index.js', source);

        await copyFile(indexPath, new URL('index.js', target));

        return ExecutionGraph.createWatchableResult({
          path: indexPath,
          result: null
        });
      }
    },
    serviceWorkerFile: {
      dependencies: ['paths'],
      async action({ paths: { source, target } }) {
        const swPath = new URL('sw.js', source);

        await copyFile(swPath, new URL('sw.js', target));

        return ExecutionGraph.createWatchableResult({
          path: swPath,
          result: null
        });
      }
    },
    manifestFile: {
      dependencies: ['paths'],
      async action({ paths: { source, target } }) {
        const manifestPath = new URL('manifest.json', source);

        await copyFile(manifestPath, new URL('manifest.json', target));

        return ExecutionGraph.createWatchableResult({
          path: manifestPath,
          result: null
        });
      }
    },
    css: {
      dependencies: ['paths'],
      async action({ paths: { source, target } }) {
        if (cssUrl) {
          await unlink(cssUrl);
        }

        const { url, htmlPath } = await generateMainCss({
          entry: new URL('css/entry.css', source),
          targetDirectory: target,
          codeStyle: 'default'
        });

        cssUrl = url;

        return ExecutionGraph.createWatchableResult({
          path: new URL('css/', source),
          result: htmlPath
        });
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
      action({ postFiles: posts, css: cssPath, templates: { tag: template } }) {
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
      action({ postFiles: resources, backlinks, templates: { blog: template }, css: cssPath }) {
        return renderResources({ resources, backlinks, template, cssPath, baseUrl, dev });
      }
    },
    renderedJapaneseNotes: {
      dependencies: ['css', 'templates', 'japaneseNotesFiles', 'backlinks'],
      action({ japaneseNotesFiles: resources, backlinks, templates: { blog: template }, css: cssPath }) {
        return renderResources({ resources, backlinks, template, cssPath, baseUrl, dev });
      }
    },
    renderedNotes: {
      dependencies: ['css', 'templates', 'noteFiles'],
      action({ noteFiles: resources, templates: { note: template }, css: cssPath }) {
        return renderResources({ resources, template, cssPath, baseUrl, dev });
      }
    },
    renderedStudySessions: {
      dependencies: ['css', 'templates', 'studySessionFiles'],
      action({ studySessionFiles: resources, templates: { 'study-session': template }, css: cssPath }) {
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
      action({ replyFiles: resources, templates: { reply: template }, css: cssPath }) {
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
          title: 'Japanese Study Notes'
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
    renderedStudySessionsIndex: {
      dependencies: ['css', 'templates', 'studySessionFiles'],
      action({ studySessionFiles: studySessions, templates, css: cssPath }) {
        return templates['study-sessions']({
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
      action({ css: cssPath, paths: { target }, templates, feeds }) {
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

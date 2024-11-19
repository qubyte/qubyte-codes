import { join as pathJoin } from 'node:path';
import fetchOldFeedToUrls from '../fetch-old-feed-to-urls.js';
import readNewFeedToUrls from '../read-new-feed-to-urls.js';
import getTagsForUrl from './get-tags-for-url.js';
import postToMastodon from '../../lib/post-to-mastodon.js';
import getEnvVar from '../get-env-var.js';
import blueskyAuth from '../../lib/bluesky-auth.js';
import postToBluesky from '../../lib/post-to-bluesky.js';

/** @param {string} publishDir */
function buildfeedPath(publishDir) {
  return pathJoin('.', publishDir, 'atom.xml');
}

function buildFeedUrl() {
  return new URL('/atom.xml', getEnvVar('URL'));
}

// This is probably unnecessary since each method in this module will only be
// invoked once (and even then only in sequence).
/** @type Map<string, Map<string, Date>> */
const oldUrlsForBuild = new Map();
const pageRegex = new RegExp('^https://qubyte.codes/blog/.+');

export async function onPreBuild({ constants, utils }) {
  try {
    const feedPath = buildfeedPath(constants.PUBLISH_DIR);
    const restored = await utils.cache.restore(feedPath);

    if (restored) {
      const oldUrls = await readNewFeedToUrls(feedPath);
      console.log('Feed retrieved from cache. Number of old URLs:', oldUrls.size);
      oldUrlsForBuild.set(getEnvVar('BUILD_ID'), oldUrls);
    } else {
      const oldUrls = await fetchOldFeedToUrls(buildFeedUrl());
      oldUrlsForBuild.set(getEnvVar('BUILD_ID'), oldUrls);
      console.log('Feed retrieved from network fallback. Number of old URLs:', oldUrls.size);
    }
  } catch (error) {
    utils.build.failPlugin('Error making feed request.', { error });
  }
}

export async function onSuccess({ constants, utils }) {
  const feedPath = pathJoin('.', constants.PUBLISH_DIR, 'atom.xml');
  const oldUrls = oldUrlsForBuild.get(getEnvVar('BUILD_ID')) || new Map();
  const newUrls = await readNewFeedToUrls(feedPath);

  console.log('Number of new URLs:', newUrls.size);

  await utils.cache.save(feedPath);

  let blueskyAuthResult = null;

  // URLs are checked and mentions dispatched in sequence deliberately to make
  // logs more comprehensible. It will be uncommon for more than one URL to be
  // new at a time anyway.
  for (const [url] of newUrls) {
    if (pageRegex.test(url) && !oldUrls.has(url)) {
      console.log('Dispatching announcements for:', url);

      let titleAndTags;

      try {
        titleAndTags = await getTagsForUrl(new URL(url));
      } catch (error) {
        console.error(`Error getting tags for ${url}: ${error.stack || error.message}`);
        continue;
      }

      try {
        blueskyAuthResult ||= await blueskyAuth('qubyte.codes', getEnvVar('BLUESKY_APP_PASSWORD'));

        await postToMastodon({
          endpoint: '/api/v1/statuses',
          mastodonBaseUrl: getEnvVar('MASTODON_BASE_URL'),
          mastodonAccessToken: getEnvVar('MASTODON_ACCESS_TOKEN'),
          body: new URLSearchParams({ status: buildTootText(url, titleAndTags.tags) })
        });

        await postToBluesky({
          endpoint: '/xrpc/com.atproto.repo.createRecord',
          body: Buffer.from(JSON.stringify({
            repo: blueskyAuthResult.did,
            collection: 'app.bsky.feed.post',
            record: buildBlueskyPost(titleAndTags.title, url, titleAndTags.tags)
          })),
          blueskyAccessToken: blueskyAuthResult.accessJwt,
          headers: { 'content-type': 'application/json' }
        });

        console.log('Done dispatching announcement for:', url);
      } catch (error) {
        console.error(`Error dispatching announcements for ${url}: ${error.stack || error.message}`);
      }
    }
  }
}

function buildTootText(url, tags) {
  return `New blog post published! ${url} ${tags.join(' ')}`.trim();
}

function buildBlueskyPost(title, url, tags) {
  let message = 'New blog post published!';
  let byteStart = Buffer.byteLength(message);

  message += ` ${title}`;

  const post = {
    $type: 'app.bsky.feed.post',
    createdAt: new Date().toISOString(),
    facets: [
      {
        index: {
          byteStart,
          byteEnd: Buffer.byteLength(message)
        },
        features: [
          {
            $type: 'app.bsky.richtext.facet#link',
            uri: url
          }
        ]
      }
    ]
  };

  for (const tag of tags) {
    byteStart = Buffer.byteLength(message + 1);
    message += ` ${tag}`;

    post.facets.push({
      index: {
        byteStart,
        byteEnd: Buffer.byteLength(message)
      },
      features: [
        {
          $type: 'app.bsky.richtext.facet#tag',
          tag: tag.slice(1) // discard hash
        }
      ]
    });
  }

  post.text = message;

  return post;
}

export function onEnd() {
  oldUrlsForBuild.delete(getEnvVar('BUILD_ID'));
}

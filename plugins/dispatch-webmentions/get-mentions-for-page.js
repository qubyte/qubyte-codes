import { pathToFileURL, fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { Mention } from './mention.js';

/** @param {JSDOM[]} doms */
async function getMentionsFromPages(doms, ignoredHostnames) {
  const mentions = [];
  const checked = new Set();

  for (const { window: { document, location: { href: source } } } of doms) {
    /** @type NodeListOf<HTMLAnchorElement> */
    const anchors = document.querySelectorAll('.h-entry a[href]');

    // I'm deliberately awaiting in a loop here so that any errors are easier to
    // debug. There are unlikely to be more than a handfull of endpoints per
    // page anyway.
    for (const { href: url } of anchors) {
      try {
        const { href: target, protocol, hostname } = new URL(url);

        // Only attempt endpoint discovery once per URL.
        if ((protocol === 'http:' || protocol === 'https:') && !checked.has(target) && !ignoredHostnames.includes(hostname)) {
          checked.add(target);

          const mention = await Mention.discover(source, target);

          if (mention) {
            mentions.push(mention);
          }
        }
      } catch (e) {
        console.error('Failed to parse page:', e.stack || e.message);
      }
    }
  }

  return mentions;
}

/**
 * Given the URL a page _will_ have, and the public directory, this function
 * loads the file from the file system and feeds it to JSDOM with the URL,
 * simulating the page after deployment.
 *
 * @param {string} url
 * @param {string} publicDirPath
 */
function loadDomFromFile(url, publicDirPath) {
  // Make a file URL for the public directory.
  const pathUrl = pathToFileURL(publicDirPath);

  // Trim a trailing "/".
  if (pathUrl.pathname.endsWith('/')) {
    pathUrl.pathname = pathUrl.pathname.slice(0, -1);
  }

  pathUrl.pathname += new URL(`${url}.html`).pathname;

  return JSDOM.fromFile(fileURLToPath(pathUrl), { url });
}

/**
 * We try to get content both for the current live page (last deploy) and the
 * soon-to-be-published page. This allows mentions to be sent to all endpoints
 * for both versions of the page. This is important because webmentions must
 * be dispatched when:
 *
 * - A page is new (this is the typical scenario).
 * - A page is deleted (removed links must be re-notified so the endpoint knows they're gone).
 * - A page is updated:
 *   - New links should trigger mentions.
 *   - Endpoints for deleted links should be re-notified.
 *   - Endpoints for existing links should be re-notified.
 *
 * The mentions themselves look the same regardless of the scenario. It's up to
 * The endpoint (or their owner) to determine if the notifying page exists and
 * that it contains a link to them.
 *
 * This endpoint returns a promise which resolves to a map of target URLs to
 * their endpoints.
 *
 * @param {string} url
 * @param {string} publicDir
 * @param {object} options
 * @param {boolean} [options.new]
 * @param {boolean} [options.old]
 * @param {string[]} [options.ignoredHostnames]
 */
export default async function getMentionsForPage(url, publicDir, options) {
  const contents = await Promise.all([
    // The old version may have links removed in the new version.
    options.old ? JSDOM.fromURL(url) : null,
    // The new version may have links not present in the old version.
    options.new ? loadDomFromFile(url, publicDir) : null
  ]);

  return getMentionsFromPages(contents.filter(Boolean), options.ignoredHostnames || []);
}

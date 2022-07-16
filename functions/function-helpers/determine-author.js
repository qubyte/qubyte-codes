/**
 * STEP 1, find the author:
 * - Check URL for an h-entry. When there's no h-entry, stop.
 * - If the h-entry has an author, return it.
 * - If the h-entry has a parent h-feed, return it. x
 *
 * STEP 2, get an h-card from the author:
 * - If the author is an h-card, return it, exit.
 * - If the author is text, return it as an author name, exit.
 * - If the author is an anchor, it is the _author page_.
 *
 * STEP 3, handle rel-author (skipped as legacy)
 *
 * STEP 4, handle author page:
 * - Fetch the author page, parse for microformats.
 * - If there is at least one h-card with url == uid == author page URL, return
 *   the first.
 * - If there is at least one h-card with a url matching a rel="me" link on the
 *   page, return the first.
 * - If there is at least one h-card with url == author page URL, return the
 *   first.
 */
import fetch from 'node-fetch';
import { mf2 } from 'microformats-parser';
import LinkHeader from 'http-link-header';

async function getMicroformatsForUrl(url) {
  const res = await fetch(url);
  const headerRelMes = LinkHeader.parse(res.headers.get('link') || '')
    .rel('me')
    .map(r => r.uri);

  if (!res.ok) {
    throw new Error(`Unexpected status from ${url}: ${res.status}`);
  }

  const microformats = mf2(await res.text(), { baseUrl: url });

  return { microformats, headerRelMes };
}

/** @param {URL} url */
// eslint-disable-next-line complexity
async function getHCardFomAuthorPage(url) {
  const { microformats, headerRelMes } = await getMicroformatsForUrl(url);

  for (const item of microformats) {
    if (item.type.includes('h-card')) {
      const itemUrl = item.url && item.url[0];
      const itemUid = item.uid && item.uid[0];

      if (itemUrl === url.href && itemUid === url.href) {
        return item;
      }
    }
  }

  // Check link headers too?
  const mes = new Set(headerRelMes);

  for (const [uri, { rels }] of Object.entries(microformats['rel-urls'])) {
    if (rels.includes('me')) {
      mes.add(uri);
    }
  }

  for (const item of microformats) {
    if (mes.has(item.url)) {
      return item;
    }
  }

  for (const item of microformats) {
    if (item.type.includes('h-card')) {
      const itemUrl = item.url && item.url[0];

      if (itemUrl === url.href) {
        return item;
      }
    }
  }
}

export async function determineAuthor(url) {
  const microformats = await getMicroformatsForUrl(url);
  const hEntry = microformats.items.find(item => item.type.includes('h-entry'));

  // Not implementing h-feed check.

  const author = hEntry.author?.filter(a => a && (typeof a === 'string' || a.type?.includes('h-card')))[0];

  if (!author) {
    return null;
  }

  if (typeof author !== 'string') {
    return author;
  }

  try {
    return getHCardFomAuthorPage(new URL(author, url));
  } catch {
    return { name: author };
  }
}

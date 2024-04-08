// @ts-check

/** @typedef {import('./load-post-files.js').PostPage} PostPage */

/** @param {PostPage[]} entries */
export default function buildBacklinks(entries) {
  /** @type {Record<string, PostPage[]>} */
  const backlinks = {};

  for (const entry of entries) {
    for (const href of entry.localLinks) {
      if (!backlinks[href]) {
        backlinks[href] = [];
      }
      backlinks[href].push(entry);
    }
  }

  for (const links of Object.values(backlinks)) {
    links.sort((a, b) => a.timestamp - b.timestamp);
  }

  return backlinks;
}

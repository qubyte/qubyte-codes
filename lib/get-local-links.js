// @ts-check

/** @param {Document} document */
export default function getLocalLinks(document) {
  /** @type {Set<string>} */
  const localLinks = new Set();
  const baseUrl = new URL('/', document.URL);

  for (const { href } of document.querySelectorAll('a')) {
    const normalized = new URL(href, document.URL);
    const pathname = normalized.pathname;
    normalized.search = '';
    normalized.hash = '';

    if (document.URL !== normalized.href && normalized.href.startsWith(baseUrl.href)) {
      localLinks.add(pathname);
    }
  }

  return localLinks;
}

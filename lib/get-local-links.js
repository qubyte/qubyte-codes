/**
 * @param {Document} document
 * @param {string} fromUrl
 * @param {string} baseUrl
 */
export default function getLocalLinks(document, fromUrl, baseUrl) {
  /** @type Set<string> */
  const localLinks = new Set();

  for (const { href } of document.querySelectorAll('a')) {
    const normalized = new URL(href, fromUrl);

    if (normalized.href.startsWith(baseUrl)) {
      localLinks.add(normalized.pathname);
    }
  }

  return localLinks;
}

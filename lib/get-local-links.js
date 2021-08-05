export default function getLocalLinks(document, fromUrl, baseUrl) {
  const localLinks = new Set();

  for (const { href } of document.querySelectorAll('a')) {
    const normalized = new URL(href, fromUrl);

    if (normalized.href.startsWith(baseUrl)) {
      localLinks.add(normalized.pathname);
    }
  }

  return localLinks;
}

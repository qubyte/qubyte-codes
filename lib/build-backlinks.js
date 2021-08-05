export default function buildBacklinks(entries) {
  const backlinks = {};

  for (const { title, localUrl, localLinks, timestamp } of entries) {
    for (const href of localLinks) {
      if (!backlinks[href]) {
        backlinks[href] = [];
      }
      backlinks[href].push({ title, href: localUrl, timestamp });
    }
  }

  for (const links of Object.values(backlinks)) {
    links.sort((a, b) => a.timestamp - b.timestamp);
  }

  return backlinks;
}

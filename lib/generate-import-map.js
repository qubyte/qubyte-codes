// @ts-check

/**
 * @param {URL} pageUrl
 * @param {{src: String}[]} scripts
 * @param {Record<String, import('./hash-copy.js').HashCopiedPath>} hashedScripts
 */
export default function generateImportMap(pageUrl, scripts, hashedScripts) {
  /** @type {Set<string>} */
  const resolved = new Set();
  const srcs = scripts.map(s => s.src);
  const queue = srcs.map(href => new URL(href, pageUrl).pathname);

  for (let path = queue.shift(); path; path = queue.shift()) {
    if (!resolved.has(path)) {
      for (const dependency of hashedScripts[path]?.dependencies || []) {
        queue.push(new URL(dependency, new URL(path, pageUrl)).pathname);
      }
      resolved.add(path);
    }
  }

  const importMap = { imports: {} };
  let count = 0;

  for (const url of Array.from(resolved).sort()) {
    const localHashed = hashedScripts[url];

    if (localHashed && !srcs.includes(url)) {
      importMap.imports[url] = localHashed.hashedFilePath;
      count++;
    }
  }

  return count ? importMap : null;
}

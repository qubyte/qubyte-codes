export default function parseFrontMatter(raw) {
  const [, frontMatter, body] = raw.split(/^---/m);
  const filtered = frontMatter.trim()
    .split('\n')
    .filter(ln => !ln.trim().startsWith('#'))
    .join('\n');

  return { attributes: JSON.parse(filtered), body };
}

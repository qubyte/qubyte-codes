// Plucks and wraps the first paragraph out of document to form a snippet.
export default function makeSnippet(document) {
  const innerHtml = document
    .querySelector('p')
    ?.innerHTML
    .slice(0, -1);

  return `<p class="p-summary">${innerHtml}…</p>`;
}

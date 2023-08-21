/**
 * Plucks and wraps the first paragraph out of document to form a snippet.
 * @param {Document} document
 */
export default function makeSnippet(document) {
  /** @type {HTMLParagraphElement|null} */
  const firstParagraph = document.querySelector('p')?.cloneNode(true);

  if (!firstParagraph) {
    return '<p class="p-summary">No summary.</p>';
  }

  for (const refnote of firstParagraph.querySelectorAll('.footnote-ref')) {
    refnote.remove();
  }

  return `<p class="p-summary">${firstParagraph.innerHTML.slice(0, -1)}…</p>`;
}

// @ts-check

/** @param {Document} document */
export default function checkForCodeHighlight(document) {
  const hasCode = !!document.querySelector('code[class^="language-"]');

  return hasCode;
}

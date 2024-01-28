// @ts-check

/** @param {Document} document */
export default function checkForRubyAnnotations(document) {
  const hasRuby = !!document.querySelector('ruby');

  return hasRuby;
}

// @ts-check

/** @param {Document} document */
export default function checkForMaths(document) {
  const hasMaths = !!document.querySelector('math');

  return hasMaths;
}

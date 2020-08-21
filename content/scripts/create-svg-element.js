import setAttributesNS from './set-attributes-ns.js';

export default function createSvgElement(type, attributes = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', type);

  setAttributesNS(element, attributes);

  return element;
}

import setAttributesNS from './set-attributes-ns.js';
import createSvgElement from './create-svg-element.js';

export default function createContainedSvg({ className, width = 500, height = 500, ...rest }) {
  const container = document.createElement('div');

  container.className = className || 'experiment';

  const svg = createSvgElement('svg');

  setAttributesNS(svg, { viewBox: `0 0 ${width} ${height}`, ...rest });

  container.appendChild(svg);

  return { container, svg };
}

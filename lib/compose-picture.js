import { extname } from 'node:path';
import handlebars from 'handlebars';

const makePicture = handlebars.compile(`
  {{#if caption}}<figure>{{/if}}
  <picture>
    {{#each sources}}
    <source type="{{mime}}" srcset="{{srcset}}">
    {{/each}}
    <img class="u-photo" src="{{src}}" alt="{{alt}}" width="{{width}}" height="{{height}}" loading="lazy">
  </picture>
  {{#if caption}}
  <figcaption>{{caption}}</figcaption>
  </figure>
  {{/if}}
`);

const scaleRegex = /-(?<scale>\d+)x\./;

/**
 * @param {string} url
 * @param {string|null} caption
 * @param {string} alt
 * @param {Map<string, { width: number, height: number }>} imagesMap
 */
export default function composePicture(url, caption, alt, imagesMap) {
  const dimensions = imagesMap.get(url);

  if (!dimensions) {
    throw new Error(`Unknown image: ${url}`);
  }

  const { width, height } = dimensions;

  const extless = url.slice(0, -extname(url).length);

  /** @type Record<string, { ratio: number, path: string }[]> */
  const sources = {};

  for (const urlPath of imagesMap.keys()) {
    if (urlPath.startsWith(extless) && urlPath !== url && !urlPath.includes('original')) {
      const mime = `image/${extname(urlPath).slice(1)}`;
      const scaleMatch = urlPath.match(scaleRegex);
      const ratio = Number(scaleMatch?.groups?.scale || 1);

      sources[mime] ||= [];
      sources[mime].push({ ratio, path: urlPath });
    }
  }

  const sourcesList = Object
    .entries(sources)
    .toSorted((a, b) => a[0] < b[0] ? 1 : -1)
    .map(([mime, urlPaths]) => {
      const srcset = urlPaths
        .toSorted((a, b) => a.ratio - b.ratio)
        .map(({ ratio, path }) => ratio === 1 ? path : `${path} ${ratio}x`)
        .join(', ');

      return { mime, srcset };
    });

  return makePicture({ sources: sourcesList, width, height, alt, src: url, caption }).trim();
}

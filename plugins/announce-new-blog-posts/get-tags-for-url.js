import { JSDOM } from 'jsdom';

/** @param {URL} url */
export default async function getTitleAndTagsForUrl(url) {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Unexpected status code when fetching post: ${res.status}`);
  }

  const { window: { document } } = new JSDOM(await res.text());
  const title = document.title;
  const description = document.head.querySelector('meta[name="description"]')?.content;
  const thumbnailUrl = new URL(document.head.querySelector('meta[property="og:image"]')?.content, url).href;
  const tags = [];

  for (const $el of document.querySelectorAll('[rel="tag"]')) {
    const trimmed = $el.textContent?.trim();

    if (trimmed) {
      tags.push(trimmed);
    }
  }

  return { title, description, thumbnailUrl, tags };
}

export function onRequest(event) {
  event.replaceResponse(async () => {
    const sitemapRes = await fetch('https://qubyte.codes/sitemap.txt');
    const sitemap = await sitemapRes.text();
    const entries = sitemap
      .trim()
      .split('\n')
      .filter(url => url.includes('/blog/'));

    const location = entries[Math.floor(Math.random() * entries.length)].trim();

    return new Response('Found', { headers: { location }, status: 302 });
  });
}

import { JSDOM } from 'jsdom';
import linkHeader from 'http-link-header';

export class Mention {
  /**
   * @param {string|URL} source
   * @param {string|URL} target
   * @param {string|URL} endpoint
   */
  constructor(source, target, endpoint) {
    this.source = source;
    this.target = target;
    this.endpoint = endpoint;
  }

  async dispatch() {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      body: new URLSearchParams({ source: this.source, target: this.target })
    });

    if (!res.ok) {
      throw new Error(`Unexpected status from webmention endpoint: ${res.status}, ${this}`);
    }
  }

  /**
   * Use a target URL to discover a webmention endpoint. When one exists, the
   * returned promise resolves to a mention object. Otherwise null.
   *
   * https://www.w3.org/TR/webmention/#h-sender-discovers-receiver-webmention-endpoint
   * @param {string|URL} source
   * @param {string|URL} target
   */
  static async discover(source, target) {
    const res = await fetch(target);
    const [webmention] = linkHeader.parse(res.headers.link || '').rel('webmention');

    // Link header takes precedence.
    if (webmention) {
      try {
        return new Mention(source, target, new URL(webmention.uri, res.url).href);
      } catch {
        // Continue if this didn't work.
      }
    }

    if (!res.ok) {
      throw new Error(`Unexpected status: ${res.status}`);
    }

    const { window } = new JSDOM(await res.text(), { url: res.url, contentType: res.headers.get('content-type') });

    // If no webmention link header is discovered, the first webmention link or
    // anchor is picked (if any).

    const endpoint = window.document.querySelector('link[href][rel~="webmention"], a[href][rel~="webmention"]')?.href;

    try {
      return endpoint ? new Mention(source, target, new URL(endpoint).href) : null;
    } catch {
      return null;
    }
  }
}

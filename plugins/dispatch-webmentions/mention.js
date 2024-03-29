// @ts-check

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
      body: new URLSearchParams({ source: this.source.toString(), target: this.target.toString() })
    });

    if (!res.ok) {
      throw new Error(`Unexpected status from webmention endpoint: ${res.status}`);
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
    const [webmention] = linkHeader.parse(res.headers.get('link') || '').rel('webmention');

    // Link header takes precedence.
    if (webmention) {
      return new Mention(source, target, new URL(webmention.uri, res.url).href);
    }

    if (!res.ok) {
      throw new Error(`Unexpected status: ${res.status}`);
    }

    const contentTypeHeader = res.headers.get('content-type') || 'text/html';
    const contentType = contentTypeHeader
      .split(';')[0]
      .trim();

    if (contentType !== 'text/html' && contentType !== 'application/xhtml+xml') {
      return null;
    }

    const { window } = new JSDOM(await res.text(), { url: res.url, contentType });

    // If no webmention link header is discovered, the first webmention link or
    // anchor is picked (if any).

    /** @type HTMLLinkElement|HTMLAnchorElement|null */
    const endpoint = window.document.querySelector('link[href][rel~="webmention"], a[href][rel~="webmention"]');

    return endpoint ? new Mention(source, target, endpoint.href) : null;
  }
}

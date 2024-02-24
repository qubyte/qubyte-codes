// @ts-check

export default class Page {
  /**
   * @param {object} options
   * @param {string|URL} options.baseUrl
   * @param {string} options.localUrl
   * @param {string} options.content
   * @param {string} options.filename
   */
  constructor({ baseUrl, localUrl, content, filename }) {
    this.baseUrl = baseUrl;
    this.localUrl = localUrl;
    this.canonical = new URL(localUrl, baseUrl);
    this.content = content;
    this.filename = filename;
  }
}

'use strict';

const handlebars = require('handlebars');
const { promises: { readFile, readdir } } = require('fs');
const buildPaths = require('./build-paths');

// A helper to turn a datetime into a human readable string.
handlebars.registerHelper('humanDate', datetime => new Date(datetime).toDateString());
handlebars.registerHelper('humanDateTime', datetime => new Date(datetime).toUTCString());
handlebars.registerHelper('navElement', function (url, name) {
  if (url === this.localUrl) { // eslint-disable-line no-invalid-this
    return name;
  }

  const escapedUrl = handlebars.escapeExpression(url);
  const escapedName = handlebars.escapeExpression(name);

  return new handlebars.SafeString(`<a href="${escapedUrl}">${escapedName}</a>`);
});

// A helper to turn a datetime into an ISO string (without milliseconds).
handlebars.registerHelper('isoDate', datetime => new Date(datetime)
  .toISOString()
  .replace(/\.[0-9]{3}Z/, 'Z')
);

const year = new Date().getUTCFullYear();

handlebars.registerHelper('year', () => year);

module.exports = async function loadTemplates({ baseTitle }) {
  handlebars.registerHelper('baseTitle', () => baseTitle);

  const partialsPath = buildPaths.src('templates', 'partials');
  const templatesPath = buildPaths.src('templates', 'documents');

  const [documentsSources] = await Promise.all([
    readdir(templatesPath)
      .then(filenames => {
        const templateFilenames = filenames.filter(n => n.endsWith('.handlebars'));

        return Promise.all(templateFilenames.map(async n => {
          const source = await readFile(buildPaths.src('templates', 'documents', n), 'utf8');
          const [name] = n.split('.');

          return [name, source.trim()];
        }));
      }),
    readdir(partialsPath)
      .then(filenames => {
        const partialFilenames = filenames.filter(n => n.endsWith('.handlebars'));

        return Promise.all(partialFilenames.map(async n => {
          const source = await readFile(buildPaths.src('templates', 'partials', n), 'utf8');
          const [name] = n.split('.');

          handlebars.registerPartial(name, source.trim());
        }));
      })
  ]);

  const templates = {};

  for (const [name, source] of documentsSources) {
    templates[name] = handlebars.compile(source);
  }

  return templates;
};

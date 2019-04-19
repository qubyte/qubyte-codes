'use strict';

const handlebars = require('handlebars');
const { promises: { readFile, readdir } } = require('fs');
const buildPaths = require('./build-paths');

// A helper to turn a datetime into a human readable string.
handlebars.registerHelper('humanDate', datetime => new Date(datetime).toDateString());
handlebars.registerHelper('humanDateTime', datetime => new Date(datetime).toUTCString());

// A helper to turn a datetime into an ISO string (without milliseconds).
handlebars.registerHelper('isoDate', datetime => new Date(datetime)
  .toISOString()
  .replace(/\.[0-9]{3}Z/, 'Z')
);

const year = new Date().getUTCFullYear();

handlebars.registerHelper('year', () => year);

module.exports = async function loadTemplates() {
  const partialsPath = buildPaths.src('templates', 'partials');
  const partialFilenames = (await readdir(partialsPath)).filter(n => n.endsWith('.handlebars'));

  await Promise.all(partialFilenames.map(async n => {
    const source = await readFile(buildPaths.src('templates', 'partials', n), 'utf8');
    const [name] = n.split('.');

    handlebars.registerPartial(name, source.trim());
  }));

  const templatesPath = buildPaths.src('templates', 'documents');
  const templateFilenames = (await readdir(templatesPath)).filter(n => n.endsWith('.handlebars'));
  const templates = {};

  await Promise.all(templateFilenames.map(async n => {
    const source = await readFile(buildPaths.src('templates', 'documents', n), 'utf8');
    const [name] = n.split('.');

    templates[name] = handlebars.compile(source.trim());
  }));

  return templates;
};

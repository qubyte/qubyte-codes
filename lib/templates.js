'use strict';

const handlebars = require('handlebars');
const { promises: { readFile } } = require('fs');
const buildPaths = require('./build-paths');

// A helper to turn a datetime into a human readable string.
handlebars.registerHelper('humanDate', datetime => new Date(datetime).toDateString());

// A helper to turn a datetime into an ISO string (without milliseconds).
handlebars.registerHelper('isoDate', datetime => new Date(datetime)
  .toISOString()
  .replace(/\.[0-9]{3}Z/, 'Z')
);

// Loads and renders a partial template.
exports.loadPartial = async filename => {
  const name = filename.slice(0, filename.indexOf('.'));
  const source = await readFile(buildPaths.src('templates', filename), 'utf-8');

  handlebars.registerPartial(name, source);
};

// Loads a template from the filesystem and compiles it to a function.
exports.loadTemplate = async filename => {
  const source = await readFile(buildPaths.src('templates', filename), 'utf-8');

  return handlebars.compile(source);
};

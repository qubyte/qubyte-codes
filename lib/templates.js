'use strict';

const handlebars = require('handlebars');
const { promises: { readFile, readdir } } = require('fs');
const path = require('path');

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
handlebars.registerHelper('encodeUriComponent', encodeURIComponent);

// A helper to turn a datetime into an ISO string (without milliseconds).
handlebars.registerHelper('isoDate', datetime => new Date(datetime)
  .toISOString()
  .replace(/\.[0-9]{3}Z/, 'Z')
);

handlebars.registerHelper('initialUpper', string => string[0].toUpperCase() + string.slice(1));

const year = new Date().getUTCFullYear();

handlebars.registerHelper('year', () => year);

function makePicker(list) {
  let previous = list.length;

  // Never pick the same item twice!
  return function picker() {
    const index = Math.floor(Math.random() * (list.length - 1));
    const adjusted = index < previous ? index : index + 1;

    previous = adjusted;

    return list[adjusted];
  };
}

handlebars.registerHelper('lightEmoji', makePicker(['🌴', '☀️', '🕶', '🐬', '🦜', '🍉']));
handlebars.registerHelper('darkEmoji', makePicker(['⭐️', '🌙', '🍹', '🌴', '🎷']));

async function getTemplateAndName(directory, filename) {
  const source = await readFile(path.join(directory, filename), 'utf8');
  const { name } = path.parse(filename.slice(0, -('.handlebars'.length)));

  return [name, source.trim()];
}

module.exports = async function loadTemplates(dir, { baseTitle }) {
  handlebars.registerHelper('baseTitle', () => baseTitle);

  const partialsPath = path.join(dir, 'partials');
  const templatesPath = path.join(dir, 'documents');
  const templates = {};

  const [documentsSources] = await Promise.all([
    readdir(templatesPath)
      .then(filenames => {
        const templateFilenames = filenames.filter(n => n.endsWith('.handlebars'));

        return Promise.all(templateFilenames.map(n => getTemplateAndName(templatesPath, n)));
      }),
    readdir(partialsPath)
      .then(filenames => {
        const partialFilenames = filenames.filter(n => n.endsWith('.handlebars'));

        return Promise.all(partialFilenames.map(async n => {
          const [name, source] = await getTemplateAndName(partialsPath, n);

          handlebars.registerPartial(name, source);
        }));
      })
  ]);

  for (const [name, source] of documentsSources) {
    templates[name] = handlebars.compile(source);
  }

  return templates;
};

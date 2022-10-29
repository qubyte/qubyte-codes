import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import handlebars from 'handlebars';

const dateFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: 'UTC' });

/** @type Map<string, Intl.DateTimeFormat> */
const formatterCache = new Map();

// A helper to turn a datetime into a human readable string.
handlebars.registerHelper('humanDate', stamp => dateFormatter.format(new Date(stamp)));
handlebars.registerHelper('humanDateTime', (stamp, timeZone) => {
  let formatter = formatterCache.get(timeZone);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'long', timeZone });
    formatterCache.set(timeZone, formatter);
  }

  return formatter.format(new Date(stamp));
});
handlebars.registerHelper('navElement', function (url, name) {
  const escapedName = handlebars.escapeExpression(name);

  if (url === this.localUrl) { // eslint-disable-line no-invalid-this
    return escapedName;
  }

  const escapedUrl = handlebars.escapeExpression(url);

  return new handlebars.SafeString(`<a href="${escapedUrl}">${escapedName}</a>`);
});
handlebars.registerHelper('encodeUriComponent', encodeURIComponent);

// A helper to turn a datetime into an ISO string (without milliseconds).
handlebars.registerHelper('isoDate', datetime => new Date(datetime)
  .toISOString()
  .replace(/\.\d{3}Z/, 'Z')
);

handlebars.registerHelper('initialUpper', string => string[0].toUpperCase() + string.slice(1));

const year = new Date().getUTCFullYear();

handlebars.registerHelper('year', () => year);

handlebars.registerHelper('hash', (field, chars) => {
  return createHash('sha256')
    .update(field)
    .digest('hex')
    .slice(0, chars);
});

function makePicker(list) {
  let filtered = list;

  // Never pick the same item twice!
  return function picker() {
    const item = filtered[Math.floor(Math.random() * filtered.length)];

    filtered = list.filter(el => el !== item);

    return item;
  };
}

handlebars.registerHelper('lightEmoji', makePicker(['🌴', '☀️', '🕶', '🐬', '🦜', '🍉']));
handlebars.registerHelper('darkEmoji', makePicker(['⭐️', '🌙', '🍹', '🌴', '🎷']));

async function getTemplateAndName(directory, filename) {
  const source = await readFile(new URL(filename, directory), 'utf8');
  const name = filename.slice(0, filename.lastIndexOf('.', filename.length - 12)); // trim off .ext.handlebars

  return [name, source.trim()];
}

export default async function loadTemplates(dir, { baseTitle }) {
  handlebars.registerHelper('baseTitle', () => baseTitle);

  const partialsPath = new URL('partials/', dir);
  const templatesPath = new URL('documents/', dir);
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
}

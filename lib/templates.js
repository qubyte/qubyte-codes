import fs from 'node:fs/promises';
import handlebars from 'handlebars';

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'long', timeZone: 'UTC' });
const dateFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: 'UTC' });

// A helper to turn a datetime into a human readable string.
handlebars.registerHelper('humanDate', stamp => dateFormatter.format(new Date(stamp)));
handlebars.registerHelper('humanDateTime', stamp => dateTimeFormatter.format(new Date(stamp)));
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
  const source = await fs.readFile(new URL(filename, directory), 'utf8');
  const name = filename.slice(0, filename.lastIndexOf('.', filename.length - 12)); // trim off .ext.handlebars

  return [name, source.trim()];
}

export default async function loadTemplates(dir, { baseTitle }) {
  handlebars.registerHelper('baseTitle', () => baseTitle);

  const partialsPath = new URL('partials/', dir);
  const templatesPath = new URL('documents/', dir);
  const templates = {};

  const [documentsSources] = await Promise.all([
    fs.readdir(templatesPath)
      .then(filenames => {
        const templateFilenames = filenames.filter(n => n.endsWith('.handlebars'));

        return Promise.all(templateFilenames.map(n => getTemplateAndName(templatesPath, n)));
      }),
    fs.readdir(partialsPath)
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

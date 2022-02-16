import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import handlebars from 'handlebars';

const dateFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: 'UTC' });

function makePicker(list) {
  let filtered = list;

  // Never pick the same item twice!
  return function picker() {
    const item = filtered[Math.floor(Math.random() * filtered.length)];

    filtered = list.filter(el => el !== item);

    return item;
  };
}

async function getTemplateAndName(directory, filename) {
  const source = await readFile(new URL(filename, directory), 'utf8');
  const name = filename.slice(0, filename.lastIndexOf('.', filename.length - 12)); // trim off .ext.handlebars

  return [name, source.trim()];
}

export default async function loadTemplates(dir, { baseTitle: title }) {
  const fullYear = new Date().getUTCFullYear();
  const bars = handlebars.create();

  bars.registerHelper({
    baseTitle() {
      return title;
    },
    lightEmoji: makePicker(['🌴', '☀️', '🕶', '🐬', '🦜', '🍉']),
    darkEmoji: makePicker(['⭐️', '🌙', '🍹', '🌴', '🎷']),
    ifeq(a, b, { fn, inverse }) {
      return a === b ? fn(this) : inverse(this); // eslint-disable-line no-invalid-this
    },
    hash(field, chars) {
      return createHash('sha256')
        .update(field)
        .digest('hex')
        .slice(0, chars);
    },
    year() {
      return fullYear;
    },
    initialUpper(string) {
      return string[0].toUpperCase() + string.slice(1);
    },
    isoDate(datetime) {
      return new Date(datetime)
        .toISOString()
        .replace(/\.\d{3}Z/, 'Z');
    },
    encodeUriComponent: encodeURIComponent,
    navElement(url, name) {
      const escapedName = bars.escapeExpression(name);

      if (url === this.localUrl) { // eslint-disable-line no-invalid-this
        return escapedName;
      }

      const escapedUrl = bars.escapeExpression(url);

      return new bars.SafeString(`<a href="${escapedUrl}">${escapedName}</a>`);
    },
    humanDateTime(stamp, timeZone) {
      return new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'long', timeZone }).format(new Date(stamp));
    },
    humanDate(stamp) {
      return dateFormatter.format(new Date(stamp));
    }
  });

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

          bars.registerPartial(name, source);
        }));
      })
  ]);

  for (const [name, source] of documentsSources) {
    templates[name] = bars.compile(source);
  }

  return templates;
}

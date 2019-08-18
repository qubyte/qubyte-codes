'use strict';

module.exports = function renderNotes(notes, noteTemplate, cssPath, dev) {
  const rendered = [];

  for (let i = 0; i < notes.length; i++) {
    const previous = notes[i - 1];
    const note = notes[i];
    const next = notes[i + 1];
    const renderObject = { ...note, cssPath, dev, title: 'Note' };

    if (previous) {
      renderObject.prevLink = previous.localUrl;
    }

    if (next) {
      renderObject.nextLink = next.localUrl;
    }

    rendered.push({
      html: noteTemplate(renderObject),
      filename: `${note.timestamp}.html`
    });
  }

  return rendered;
};

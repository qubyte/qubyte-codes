'use strict';

const { extname } = require('path');
const { upload } = require('./upload');

exports.uploadImage = async function uploadImage(photo) {
  const time = Date.now();
  const suffix = extname(photo.filename);
  const filename = `${time}${suffix}`;

  await upload('New photo.\n\n[skip ci]', 'images', filename, photo.content);

  return `/images/${time}${suffix}`;
};

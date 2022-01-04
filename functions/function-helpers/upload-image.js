const { extname } = require('path');
const { upload } = require('./upload');

exports.uploadImage = async function uploadImage(photo) {
  const time = Date.now();
  const suffix = extname(photo.filename);

  await upload('New photo.\n\n[skip ci]', 'images', time, suffix, photo.content);

  return `/images/${time}${suffix}`;
};

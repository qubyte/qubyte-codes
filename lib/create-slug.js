'use strict';

const slugify = require('slugify');

module.exports = function createSlug(title) {
  return `${slugify(title, { lower: true, remove: /[#$*_+~.()'"!:@?]/g })}`;
};

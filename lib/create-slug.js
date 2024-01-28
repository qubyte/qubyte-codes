// @ts-check

import slugify from 'slugify';

/** @param {String} title */
export default function createSlug(title) {
  return `${slugify(title, { lower: true, remove: /[#$*_+~,.()'"!:@?]/g })}`;
}

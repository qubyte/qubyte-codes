import slugify from 'slugify';

export default function createSlug(title) {
  return `${slugify(title, { lower: true, remove: /[#$*_+~,.()'"!:@?]/g })}`;
}

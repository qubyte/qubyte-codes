// @ts-check

import { find } from 'geo-tz';

/**
 * @param {number} lat
 * @param {number} long
 */
export default function (lat, long) {
  try {
    return find(lat, long)[0] || 'UTC';
  } catch {
    return 'UTC';
  }
}

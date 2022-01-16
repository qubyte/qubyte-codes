import { find } from 'geo-tz';

export default function (lat, long) {
  try {
    return find(lat, long)[0] || 'UTC';
  } catch {
    return 'UTC';
  }
}

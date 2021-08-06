import geoTz from 'geo-tz';

export default function (lat, long) {
  try {
    return geoTz(lat, long)[0] || 'UTC';
  } catch {
    return 'UTC';
  }
}

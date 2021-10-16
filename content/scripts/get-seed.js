const hasCrypto = typeof crypto === 'object' && crypto && typeof crypto.getRandomValues === 'function';
const hasUint32Array = typeof Uint32Array === 'function';

export default function getSeed() {
  const seedParam = Number(new URLSearchParams(location.search).get('seed'));

  if (seedParam) {
    return seedParam;
  }

  if (hasCrypto && hasUint32Array) {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  }

  return Date.now();
}

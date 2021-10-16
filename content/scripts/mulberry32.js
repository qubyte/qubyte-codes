// Adapted from mulberry32 found here: https://github.com/bryc/code/blob/master/jshash/PRNGs.md

export default function mulberry32(seed) {
  /* eslint no-bitwise: off */
  let a = seed;

  return function random() {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t += Math.imul(t ^ t >>> 7, 61 | t) ^ t;

    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

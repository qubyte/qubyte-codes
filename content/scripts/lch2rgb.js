// This file is based on functions found in d3-color.
const t0 = 4 / 29;
const t1 = 6 / 29;
const t2 = 3 * t1 * t1;

function lrgb2rgb(x) {
  return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
}

function lab2xyz(t) {
  return t > t1 ? t * t * t : t2 * (t - t0);
}

export default function lch2rgb(l, c, h) {
  const a = Math.cos(h * Math.PI / 180) * c;
  const b = Math.sin(h * Math.PI / 180) * c;
  const prey = (l + 16) / 116;
  const prex = isNaN(a) ? prey : prey + a / 500;
  const prez = isNaN(b) ? prey : prey - b / 200;
  const x = 0.96422 * lab2xyz(prex);
  const y = lab2xyz(prey);
  const z = 0.82521 * lab2xyz(prez);

  return [
    lrgb2rgb(+3.1338561 * x - 1.6168667 * y - 0.4906146 * z),
    lrgb2rgb(-0.9787684 * x + 1.9161415 * y + 0.0334540 * z),
    lrgb2rgb(+0.0719453 * x - 0.2289914 * y + 1.4052427 * z)
  ];
}

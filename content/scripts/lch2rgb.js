// This file is based on functions found in d3-color.

const Xn = 0.96422;
const Yn = 1;
const Zn = 0.82521;
const t0 = 4 / 29;
const t1 = 6 / 29;
const t2 = 3 * t1 * t1;

function hc2ab(h, c) {
  return [Math.cos(h * Math.PI / 180) * c, Math.sin(h * Math.PI / 180) * c];
}

function lrgb2rgb(x) {
  return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
}

function lab2xyz(t) {
  return t > t1 ? t * t * t : t2 * (t - t0);
}

function lab2rgb(l, a, b) {
  let y = (l + 16) / 116;
  let x = isNaN(a) ? y : y + a / 500;
  let z = isNaN(b) ? y : y - b / 200;

  x = Xn * lab2xyz(x);
  y = Yn * lab2xyz(y);
  z = Zn * lab2xyz(z);

  return [
    lrgb2rgb(+3.1338561 * x - 1.6168667 * y - 0.4906146 * z),
    lrgb2rgb(-0.9787684 * x + 1.9161415 * y + 0.0334540 * z),
    lrgb2rgb(+0.0719453 * x - 0.2289914 * y + 1.4052427 * z)
  ];
}

export default function lch2rgb(l, c, h) {
  const [a, b] = hc2ab(h, c);
  return lab2rgb(l, a, b);
}

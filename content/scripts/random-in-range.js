export default function randomInRange(min, max, random = Math.random) {
  return (max - min) * random() + min;
}

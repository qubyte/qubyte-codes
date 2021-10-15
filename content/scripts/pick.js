export default function pick(array, random = Math.random) {
  return array[Math.floor(array.length * random())];
}

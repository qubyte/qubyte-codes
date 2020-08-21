export default function setAttributesNS(element, attributes) {
  for (const [key, val] of Object.entries(attributes)) {
    element.setAttributeNS(null, key, val);
  }

  return element;
}

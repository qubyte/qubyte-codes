function setAttributes(node, attributes) {
  for (const [key, val] of Object.entries(attributes)) {
    node.setAttribute(key, val);
  }

  return node;
}

export default class Battenberg {
  constructor({ boxWidth = 400, cornerRadius = boxWidth / 8, θ = 0, φ = 0, ω = 0, δθ = 0, δφ = 0, δω = 0 } = {}) {
    this.boxWidth = boxWidth;
    this.cornerRadius = cornerRadius;
    this.θ = θ;
    this.φ = φ;
    this.ω = ω;
    this.δθ = δθ;
    this.δφ = δφ;
    this.δω = δω;
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.width = boxWidth / Math.sqrt(6);
    this.length = 2 * this.width;
    this.paths = [];

    this.svg.setAttribute('width', boxWidth);
    this.svg.setAttribute('height', boxWidth);
  }

  update(dt) {
    this.θ = (this.θ + this.δθ * dt) % (2 * Math.PI);
    this.φ = (this.φ + this.δφ * dt) % (2 * Math.PI);
    this.ω = (this.ω + this.δω * dt) % (2 * Math.PI);

    return this;
  }

  setOuterPath(cosθ, sinθ, cosφ, sinφ) {
    const factorφ = ((this.θ / Math.PI) < 0.5 || (this.θ / Math.PI) > 1.5) ? -1 : 1;
    const { width: w, cornerRadius: r, length: l } = this;
    const startX = -l / 2 * sinθ + cosθ * ((w / 2 - r) * sinφ - w * cosφ / 2);
    const startY = -(w / 2 - r) * cosφ - w / 2 * sinφ;

    const path = [
      `M ${startX} ${startY}`,
      `a ${cosθ * r} ${r} 0 0 1 ${cosθ * r * cosφ} ${r * sinφ - r}`,
      `l ${l * sinθ} 0`,
      `a ${cosθ * r} ${r} 0 0 1 ${r * cosθ * sinφ} ${r * (1 - cosφ)}`,
      `l ${cosθ * (w - 2 * r) * cosφ} ${(w - 2 * r) * sinφ}`,
      `a ${cosθ * r} ${r} 0 0 1 ${cosθ * r * (cosφ - sinφ)} ${r * (cosφ + sinφ)}`,
      `l ${cosθ * (2 * r - w) * sinφ} ${(w - 2 * r) * cosφ}`,
      `a ${cosθ * r} ${r} 0 0 1 ${-r * cosθ * cosφ} ${r * (1 - sinφ)}`,
      `l ${-l * sinθ} 0`,
      `a ${cosθ * r} ${r} 0 0 1 ${-r * cosθ * sinφ} ${-r * (1 - cosφ)}`,
      `l ${cosθ * (2 * r - w) * cosφ} ${(2 * r - w) * sinφ}`,
      `a ${cosθ * r} ${r} 0 0 1 ${cosθ * r * (sinφ - cosφ)} ${-r * (cosφ + sinφ)}`,
      'Z'
    ].join(' ');

    const outerTransform = `translate(${this.boxWidth / 2} ${this.boxWidth / 2}) rotate(${this.ω / Math.PI * 180}) scale(${factorφ} 1)`;

    if (this.outerPath) {
      this.outerPath.setAttribute('d', path);
      this.outerPath.setAttribute('transform', outerTransform);
    } else {
      this.outerPath = setAttributes(document.createElementNS('http://www.w3.org/2000/svg', 'path'), {
        d: path,
        fill: '#fff2cc',
        stroke: '#ffd9cc',
        'stroke-width': 5,
        transform: outerTransform
      });
      this.svg.appendChild(this.outerPath);
    }

    return this;
  }

  setInnerPath(cosθ, sinθ, cosφ, sinφ) {
    const factorφ = ((this.θ / Math.PI) < 0.5 || (this.θ / Math.PI) > 1.5) ? -1 : 1;
    const { width: w, cornerRadius: r, length: l } = this;
    const factor = this.θ > Math.PI ? -1 : 1;
    const offset = 10;
    const ir = r - offset;
    const startX = factor * l / 2 * sinθ + cosθ * ((w / 2 - r) * sinφ - w * cosφ / 2) + offset * cosθ * cosφ;
    const startY = -(w / 2 - r) * cosφ - w / 2 * sinφ + offset * sinφ;

    const path = [
      `M ${startX} ${startY}`,
      `a ${cosθ * ir} ${ir} 0 0 1 ${cosθ * ir * (cosφ + sinφ)} ${ir * (sinφ - cosφ)}`,
      `l ${cosθ * (w / 2 - r) * cosφ} ${(w / 2 - r) * sinφ}`,
      `l ${-cosθ * (w - 2 * offset) * sinφ} ${(w - 2 * offset) * cosφ}`,
      `l ${cosθ * (w / 2 - r) * cosφ} ${(w / 2 - r) * sinφ}`,
      `a ${cosθ * ir} ${ir} 0 0 0 ${cosθ * ir * (cosφ + sinφ)} ${ir * (sinφ - cosφ)}`,
      `l ${((w / 2 - r) * sinφ) * cosθ} ${-(w / 2 - r) * cosφ}`,
      `l ${(2 * offset - w) * cosθ * cosφ} ${(2 * offset - w) * sinφ}`,
      'Z'
    ].join('');

    const innerTransform = `translate(${this.boxWidth / 2} ${this.boxWidth / 2}) rotate(${this.ω / Math.PI * 180}) scale(${factorφ} 1)`;

    if (this.innerPath) {
      this.innerPath.setAttribute('d', path);
      this.innerPath.setAttribute('transform', innerTransform);
    } else {
      this.innerPath = setAttributes(document.createElementNS('http://www.w3.org/2000/svg', 'path'), {
        d: path,
        fill: '#ffd9cc',
        'stroke-width': '2',
        transform: innerTransform
      });
      this.svg.appendChild(this.innerPath);
    }

    return this;
  }

  draw() {
    const [sinφ, cosφ] = [Math.sin(this.φ % (Math.PI / 2)), Math.cos(this.φ % (Math.PI / 2))];
    const [fsinφ, fcosφ] = [Math.sin(this.φ % (2 * Math.PI)), Math.cos(this.φ % (2 * Math.PI))];
    let [cosθ, sinθ] = [Math.abs(Math.cos(this.θ)), Math.abs(Math.sin(this.θ))];

    // Avoid some rounding issues.
    if (cosθ > -1e-6 && cosθ < 1e-6) {
      cosθ = 0;
      sinθ = 1;
    }

    this.setOuterPath(cosθ, sinθ, cosφ, sinφ);
    this.setInnerPath(cosθ, sinθ, fcosφ, fsinφ);

    return this;
  }
}

function setAttributes(node, attributes) {
  for (const [key, val] of Object.entries(attributes)) {
    node.setAttribute(key, val);
  }

  return node;
}

export default class Battenberg {
  constructor({ length = 400, width = 200, cornerRadius = 50, θ = 0, φ = 0, ω = 0, δθ = 0, δφ = 0, δω = 0 } = {}) {
    this.length = length;
    this.width = width;
    this.cornerRadius = cornerRadius;
    this.θ = θ;
    this.φ = φ;
    this.ω = ω;
    this.δθ = δθ;
    this.δφ = δφ;
    this.δω = δω;
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.maxWidth = 1.1 * Math.sqrt(2 * (width - 2 * cornerRadius) ** 2 + length ** 2);
    this.paths = [];

    this.svg.setAttribute('width', this.maxWidth);
    this.svg.setAttribute('height', this.maxWidth);
  }

  update(dt) {
    this.θ = (this.θ + this.δθ * dt) % (2 * Math.PI);
    this.φ = (this.φ + this.δφ * dt) % (2 * Math.PI);
    this.ω = (this.ω + this.δω * dt) % (2 * Math.PI);
  }

  draw() {
    const factorφ = ((this.θ / Math.PI) < 0.5 || (this.θ / Math.PI) > 1.5) ? -1 : 1;
    const { width: w, cornerRadius: r, length: l } = this;
    const [sinφ, cosφ] = [Math.sin(this.φ % (Math.PI / 2)), Math.cos(this.φ % (Math.PI / 2))];
    const [fsinφ, fcosφ] = [Math.sin(this.φ % (2 * Math.PI)), Math.cos(this.φ % (2 * Math.PI))];
    let [cosθ, sinθ] = [Math.abs(Math.cos(this.θ)), Math.abs(Math.sin(this.θ))];

    // Avoid some rounding issues.
    if (Math.abs(cosθ) < 1e-6) {
      cosθ = 0;
      sinθ = 1;
    }

    function buildOuterPath() {
      const startX = -l / 2 * sinθ + cosθ * ((w / 2 - r) * sinφ - w * cosφ / 2);
      const startY = -(w / 2 - r) * cosφ - w / 2 * sinφ;

      return [
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
    }

    const outerLine = buildOuterPath();

    const outerPath = setAttributes(document.createElementNS('http://www.w3.org/2000/svg', 'path'), {
      d: outerLine,
      fill: '#fff2cc',
      stroke: '#ffd9cc',
      'stroke-width': 5,
      transform: `translate(${this.maxWidth / 2} ${this.maxWidth / 2}) rotate(${this.ω / Math.PI * 180}) scale(${factorφ} 1)`
    });

    const factor = this.θ > Math.PI ? -1 : 1;

    function buildInnerPath() {
      const offset = 10;
      const ir = r - offset;
      const startX = factor * l / 2 * sinθ + cosθ * ((w / 2 - r) * fsinφ - w * fcosφ / 2) + offset * cosθ * fcosφ;
      const startY = -(w / 2 - r) * fcosφ - w / 2 * fsinφ + offset * fsinφ;

      return [
        `M ${startX} ${startY}`,
        `a ${cosθ * ir} ${ir} 0 0 1 ${cosθ * ir * (fcosφ + fsinφ)} ${ir * (fsinφ - fcosφ)}`,
        `l ${cosθ * (w / 2 - r) * fcosφ} ${(w / 2 - r) * fsinφ}`,
        `l ${-cosθ * (w - 2 * offset) * fsinφ} ${(w - 2 * offset) * fcosφ}`,
        `l ${cosθ * (w / 2 - r) * fcosφ} ${(w / 2 - r) * fsinφ}`,
        `a ${cosθ * ir} ${ir} 0 0 0 ${cosθ * ir * (fcosφ + fsinφ)} ${ir * (fsinφ - fcosφ)}`,
        `l ${((w / 2 - r) * fsinφ) * cosθ} ${-(w / 2 - r) * fcosφ}`,
        `l ${(2 * offset - w) * cosθ * fcosφ} ${(2 * offset - w) * fsinφ}`,
        'Z'
      ].join('');
    }

    const innerLine = buildInnerPath();

    const innerPath = setAttributes(document.createElementNS('http://www.w3.org/2000/svg', 'path'), {
      d: innerLine,
      fill: '#ffd9cc',
      'stroke-width': '2',
      transform: `translate(${this.maxWidth / 2} ${this.maxWidth / 2}) rotate(${this.ω / Math.PI * 180}) scale(${factorφ} 1)`
    });

    for (const path of this.paths || []) {
      path.remove();
    }

    this.paths = [outerPath, innerPath];

    this.svg.appendChild(outerPath);
    this.svg.appendChild(innerPath);
  }
}

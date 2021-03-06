const boxWidth = Math.min(400, document.querySelector('.e-content').clientWidth);
const container = document.createElement('div');

container.style.textAlign = 'center';
container.style.margin = '1rem 0';

const canvas = document.createElement('canvas');

canvas.width = boxWidth;
canvas.height = boxWidth;

container.appendChild(canvas);
document.querySelector('.e-content').append(container);

const context = canvas.getContext('2d');
const nDivisions = 50;
const cellLiveProb = 0.5;
const cellWidth = boxWidth / nDivisions;
const cellHeight = boxWidth / nDivisions;

function randomGrid() {
  return Uint8Array.from({ length: nDivisions ** 2 }, () => Math.random() < cellLiveProb ? 1 : 0);
}

function mod(x, y) {
  return x - y * Math.floor(x / y);
}

function countNeighbours(grid, i, j) {
  let count = 0;

  // Iterate over neighbouring indices.
  for (let x = i - 1; x <= i + 1; x++) {
    for (let y = j - 1; y <= j + 1; y++) {
      // Ignore self.
      if (x !== i || y !== j) {
        // If indices off end of grid, loop around.
        const loopedX = mod(x, nDivisions);
        const loopedY = mod(y, nDivisions);

        // Add neighbour to count.
        count += grid[loopedX * nDivisions + loopedY];
      }
    }
  }

  return count;
}

function calculateNext(grid) {
  const next = new Uint8Array(nDivisions ** 2); // Initialized to 0;

  for (let i = 0; i < nDivisions; i++) {
    for (let j = 0; j < nDivisions; j++) {
      const count = countNeighbours(grid, i, j);
      const gridIndex = i * nDivisions + j;

      if (count === 3 || (count === 2 && grid[gridIndex])) {
        next[gridIndex] = 1;
      }
    }
  }

  return next;
}

function draw(grid) {
  context.clearRect(0, 0, boxWidth, boxWidth);

  for (let i = 0; i < nDivisions; i++) {
    for (let j = 0; j < nDivisions; j++) {
      if (grid[i * nDivisions + j]) {
        context.fillRect(cellWidth * i, cellHeight * j, cellWidth, cellHeight);
      }
    }
  }

  setTimeout(draw, 100, calculateNext(grid));
}

// Necessary for CSS to have been applied. Deferred scripts and modules are
// executed just before DOMContentLoaded, which is *before* style is applied.
window.onload = function () {
  context.fillStyle = getComputedStyle(document.body).color;
  draw(randomGrid());
};

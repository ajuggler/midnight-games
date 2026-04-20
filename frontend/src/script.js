const GRID_SIZE = 5;
const CANVAS_SIZE = 500;
const CELL_SIZE = CANVAS_SIZE / GRID_SIZE;
const SQUARE_SCALE = CELL_SIZE / Math.sqrt(2);
const ARROW_SCALE = CELL_SIZE * 0.35;
const MARKER_COLOR = "rgb(16, 128, 128)";
const DEFAULT_MARKER = { i: 2, j: 2 };

const defaultDirs = [
  3, 3, 0, 0, 0,
  3, 3, 0, 0, 0,
  3, 3, 1, 1, 1,
  2, 2, 2, 1, 1,
  2, 2, 2, 1, 1
];
  
const directions = {
  0: { x: 0, y: -1 },
  1: { x: 1, y: 0 },
  2: { x: 0, y: 1 },
  3: { x: -1, y: 0 },
};

const arrowColors = {
  0: "#d21818",
  1: "#1357d8",
};

const gridCenters = centers();
const arrowDirections = [...defaultDirs];

function centers(n = GRID_SIZE) {
  const points = [];

  for (let i = 0.5; i <= n - 0.5; i += 1) {
    for (let j = 0.5; j <= n - 0.5; j += 1) {
      points.push({ x: i * CELL_SIZE, y: (n - j) * CELL_SIZE });
    }
  }

  return points;
}

function squarePoints(center) {
  const points = [];

  for (let k = 0; k < 4; k += 1) {
    const theta = Math.PI / 4 + k * Math.PI / 2;
    points.push({
      x: center.x + Math.cos(theta) * SQUARE_SCALE,
      y: center.y + Math.sin(theta) * SQUARE_SCALE,
    });
  }

  return points;
}

function drawPolygon(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }

  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawArrow(ctx, center, directionIndex, paletteIndex = 0) {
  const dir = directions[directionIndex];
  const dx = dir.x * ARROW_SCALE;
  const dy = dir.y * ARROW_SCALE;
  const from = { x: center.x - dx, y: center.y - dy };
  const to = { x: center.x + dx, y: center.y + dy };
  const headLength = CELL_SIZE * 0.14;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.strokeStyle = arrowColors[paletteIndex];
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - headLength * Math.cos(angle - Math.PI / 6),
    to.y - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    to.x - headLength * Math.cos(angle + Math.PI / 6),
    to.y - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fillStyle = arrowColors[paletteIndex];
  ctx.fill();
}

function marker(cell, radius = 0.05, offset = 0.618) {
  return {
    x: (0.5 + cell.i + offset / 2) * CELL_SIZE,
    y: (0.5 + (GRID_SIZE - 1 - cell.j) + offset / 2) * CELL_SIZE,
    radius: radius * CELL_SIZE,
  };
}

function drawMarker(ctx, cell, radius = 0.05, offset = 0.618) {
  const markerGeometry = marker(cell, radius, offset);

  ctx.beginPath();
  ctx.arc(
    markerGeometry.x,
    markerGeometry.y,
    markerGeometry.radius,
    0,
    Math.PI * 2
  );
  ctx.fillStyle = MARKER_COLOR;
  ctx.fill();
}

function renderGrid(ctx, directionsState, points = gridCenters) {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.fillStyle = "#f1ead0";
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  ctx.strokeStyle = "rgb(102, 102, 102)";
  ctx.fillStyle = "rgb(254, 204, 102)";
  ctx.lineJoin = "round";
  ctx.lineWidth = 2;

  points.forEach((point) => {
    drawPolygon(ctx, squarePoints(point));
  });

  points.forEach((point, index) => {
    const paletteIndex = Number(directionsState[index] !== defaultDirs[index]);
    drawArrow(ctx, point, directionsState[index], paletteIndex);
  });

  drawMarker(
    ctx,
    { i: DEFAULT_MARKER.i, j: DEFAULT_MARKER.j }
  );
}

function countModifiedArrows(directionsState) {
  return directionsState.reduce((total, direction, index) => {
    return total + Number(direction !== defaultDirs[index]);
  }, 0);
}

function updateModifiedCount(countElement, directionsState) {
  countElement.textContent = String(countModifiedArrows(directionsState));
}

function getCanvasCoordinates(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function findCellIndex(point) {
  if (
    point.x < 0 ||
    point.y < 0 ||
    point.x >= CANVAS_SIZE ||
    point.y >= CANVAS_SIZE
  ) {
    return -1;
  }

  const column = Math.floor(point.x / CELL_SIZE);
  const row = GRID_SIZE - 1 - Math.floor(point.y / CELL_SIZE);

  if (
    column < 0 ||
    column >= GRID_SIZE ||
    row < 0 ||
    row >= GRID_SIZE
  ) {
    return -1;
  }

  return column * GRID_SIZE + row;
}

function cycleDirectionAt(index) {
  if (index < 0 || index >= arrowDirections.length) {
    return;
  }

  arrowDirections[index] = (arrowDirections[index] + 1) % 4;
}

function handleCanvasClick(event, canvas, ctx, countElement) {
  const point = getCanvasCoordinates(event, canvas);
  const cellIndex = findCellIndex(point);

  if (cellIndex === -1) {
    return;
  }

  cycleDirectionAt(cellIndex);
  renderGrid(ctx, arrowDirections);
  updateModifiedCount(countElement, arrowDirections);
}

function init() {
  const canvas = document.getElementById("compass-canvas");
  const countElement = document.getElementById("modified-count");
  const ctx = canvas.getContext("2d");

  renderGrid(ctx, arrowDirections);
  updateModifiedCount(countElement, arrowDirections);
  canvas.addEventListener("click", (event) => {
    handleCanvasClick(event, canvas, ctx, countElement);
  });
}

init();

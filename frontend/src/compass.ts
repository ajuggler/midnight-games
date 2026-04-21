export const GRID_SIZE = 5
export const CANVAS_SIZE = 500
export const CELL_SIZE = CANVAS_SIZE / GRID_SIZE
const SQUARE_SCALE = CELL_SIZE / Math.sqrt(2)
const ARROW_SCALE = CELL_SIZE * 0.35
const MARKER_COLOR = "rgb(16, 128, 128)"

export type Direction = 0 | 1 | 2 | 3
export type DirectionsState = Direction[]
export type Point = {
  x: number
  y: number
}

type Cell = {
  i: number
  j: number
}

const DEFAULT_MARKER: Cell = { i: 2, j: 2 }

export const defaultDirections: DirectionsState = [
  3, 3, 0, 0, 0,
  3, 3, 0, 0, 0,
  3, 3, 1, 1, 1,
  2, 2, 2, 1, 1,
  2, 2, 2, 1, 1,
]

const directions: Record<Direction, Point> = {
  0: { x: 0, y: -1 },
  1: { x: 1, y: 0 },
  2: { x: 0, y: 1 },
  3: { x: -1, y: 0 },
}

const arrowColors = {
  0: "#d21818",
  1: "#1357d8",
}

export function createInitialDirections(): DirectionsState {
  return [...defaultDirections]
}

export function countModifiedArrows(directionsState: DirectionsState): number {
  return directionsState.reduce<number>((total, direction, index) => {
    return total + Number(direction !== defaultDirections[index])
  }, 0)
}

export function cycleDirectionAt(
  directionsState: DirectionsState,
  index: number
): DirectionsState {
  if (index < 0 || index >= directionsState.length) {
    return directionsState
  }

  const nextState = [...directionsState]
  nextState[index] = ((nextState[index] + 1) % 4) as Direction
  return nextState
}

export function findCellIndex(point: Point): number {
  if (
    point.x < 0 ||
    point.y < 0 ||
    point.x >= CANVAS_SIZE ||
    point.y >= CANVAS_SIZE
  ) {
    return -1
  }

  const column = Math.floor(point.x / CELL_SIZE)
  const row = GRID_SIZE - 1 - Math.floor(point.y / CELL_SIZE)

  if (
    column < 0 ||
    column >= GRID_SIZE ||
    row < 0 ||
    row >= GRID_SIZE
  ) {
    return -1
  }

  return column * GRID_SIZE + row
}

export function renderGrid(
  ctx: CanvasRenderingContext2D,
  directionsState: DirectionsState
): void {
  const gridCenters = centers()

  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  ctx.fillStyle = "#f1ead0"
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

  ctx.strokeStyle = "rgb(102, 102, 102)"
  ctx.fillStyle = "rgb(254, 204, 102)"
  ctx.lineJoin = "round"
  ctx.lineWidth = 2

  gridCenters.forEach((point) => {
    drawPolygon(ctx, squarePoints(point))
  })

  gridCenters.forEach((point, index) => {
    const paletteIndex = Number(directionsState[index] !== defaultDirections[index])
    drawArrow(ctx, point, directionsState[index], paletteIndex)
  })

  drawMarker(ctx, DEFAULT_MARKER)
}

function centers(): Point[] {
  const points: Point[] = []

  for (let i = 0.5; i <= GRID_SIZE - 0.5; i += 1) {
    for (let j = 0.5; j <= GRID_SIZE - 0.5; j += 1) {
      points.push({ x: i * CELL_SIZE, y: (GRID_SIZE - j) * CELL_SIZE })
    }
  }

  return points
}

function squarePoints(center: Point): Point[] {
  const points: Point[] = []

  for (let k = 0; k < 4; k += 1) {
    const theta = Math.PI / 4 + k * Math.PI / 2
    points.push({
      x: center.x + Math.cos(theta) * SQUARE_SCALE,
      y: center.y + Math.sin(theta) * SQUARE_SCALE,
    })
  }

  return points
}

function drawPolygon(ctx: CanvasRenderingContext2D, points: Point[]): void {
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)

  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y)
  }

  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  center: Point,
  directionIndex: Direction,
  paletteIndex = 0
): void {
  const dir = directions[directionIndex]
  const dx = dir.x * ARROW_SCALE
  const dy = dir.y * ARROW_SCALE
  const from = { x: center.x - dx, y: center.y - dy }
  const to = { x: center.x + dx, y: center.y + dy }
  const headLength = CELL_SIZE * 0.14
  const angle = Math.atan2(to.y - from.y, to.x - from.x)

  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.strokeStyle = arrowColors[paletteIndex as 0 | 1]
  ctx.lineWidth = 3
  ctx.lineCap = "round"
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(
    to.x - headLength * Math.cos(angle - Math.PI / 6),
    to.y - headLength * Math.sin(angle - Math.PI / 6)
  )
  ctx.lineTo(
    to.x - headLength * Math.cos(angle + Math.PI / 6),
    to.y - headLength * Math.sin(angle + Math.PI / 6)
  )
  ctx.closePath()
  ctx.fillStyle = arrowColors[paletteIndex as 0 | 1]
  ctx.fill()
}

function marker(cell: Cell, radius = 0.05, offset = 0.618) {
  return {
    x: (0.5 + cell.i + offset / 2) * CELL_SIZE,
    y: (0.5 + (GRID_SIZE - 1 - cell.j) + offset / 2) * CELL_SIZE,
    radius: radius * CELL_SIZE,
  }
}

function drawMarker(
  ctx: CanvasRenderingContext2D,
  cell: Cell,
  radius = 0.05,
  offset = 0.618
): void {
  const markerGeometry = marker(cell, radius, offset)

  ctx.beginPath()
  ctx.arc(
    markerGeometry.x,
    markerGeometry.y,
    markerGeometry.radius,
    0,
    Math.PI * 2
  )
  ctx.fillStyle = MARKER_COLOR
  ctx.fill()
}

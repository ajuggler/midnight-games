export const GRID_SIZE = 5
export const CANVAS_SIZE = 500
export const CELL_SIZE = CANVAS_SIZE / GRID_SIZE
export const MAX_MODIFIED_ARROWS = 3
export const READING_SQUARE_SCALE = 1.236
export const READING_SQUARE_SIZE = CELL_SIZE * READING_SQUARE_SCALE
export const CHARGE_SQUARE_SIZE = CELL_SIZE * 0.618
const SQUARE_SCALE = CELL_SIZE / Math.sqrt(2)
const ARROW_SCALE = CELL_SIZE * 0.35
const MARKER_COLOR = "rgb(16, 128, 128)"
const OPPONENT_CELL_COLOR = "rgb(255, 226, 140)"
const READING_ARROW_SCALE = READING_SQUARE_SIZE * 0.35
const READING_HEAD_LENGTH = READING_SQUARE_SIZE * 0.14
const READING_LINE_WIDTH = 3 * READING_SQUARE_SCALE

export type Direction = 0 | 1 | 2 | 3
export type DirectionsState = Direction[]
export type DirectionsGrid = Direction[][]
export type Position = [number, number]
export type Vector = [number, number]
export type Point = {
  x: number
  y: number
}

export type Cell = {
  i: number
  j: number
}

const DEFAULT_MARKER: Cell = { i: 2, j: 2 }
const PHANTOM_MARKER: Cell = { i: 0, j: 0 }

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

type ArrowOptions = {
  color?: string
  arrowScale?: number
  headLength?: number
  lineWidth?: number
}

export function createInitialDirections(): DirectionsState {
  return [...defaultDirections]
}

export function countModifiedArrows(directionsState: DirectionsState): number {
  return directionsState.reduce<number>((total, direction, index) => {
    return total + Number(direction !== defaultDirections[index])
  }, 0)
}

export function gridFromDirections(directionsState: DirectionsState): DirectionsGrid {
  const grid: DirectionsGrid = []

  for (let i = 0; i < GRID_SIZE; i += 1) {
    const row: Direction[] = []
    for (let j = 0; j < GRID_SIZE; j += 1) {
      row.push(directionsState[i * GRID_SIZE + j])
    }
    grid.push(row)
  }

  return grid
}

export function idxOf(i: number, j: number): number {
  return GRID_SIZE * i + j
}

export function directionAtIndex(
  directionsState: DirectionsState,
  index: number
): Direction {
  return directionsState[index]
}

export function randomSalt32(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32))
}

export function cycleDirectionAt(
  directionsState: DirectionsState,
  index: number
): DirectionsState {
  if (index < 0 || index >= directionsState.length) {
    return directionsState
  }

  const modifiedCount = countModifiedArrows(directionsState)
  const isCurrentlyDefault = directionsState[index] === defaultDirections[index]

  if (isCurrentlyDefault && modifiedCount >= MAX_MODIFIED_ARROWS) {
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

export function cellFromPosition(position: Position): Cell {
  return {
    i: position[0],
    j: position[1],
  }
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

function addVector(a: Position, b: Vector): Position {
  return [mod(a[0] + b[0], GRID_SIZE), mod(a[1] + b[1], GRID_SIZE)]
}

const directionAsVector: Record<Direction, Vector> = {
  0: [0, 1],
  1: [1, 0],
  2: [0, -1],
  3: [-1, 0],
}

export function futurePosition(pos: Position, dir: Direction): Position {
  return addVector(pos, directionAsVector[dir])
}
    
export function renderGrid(
  ctx: CanvasRenderingContext2D,
  directionsState: DirectionsState,
  highlightModifiedArrows = true,
  markerCell: Cell = DEFAULT_MARKER,
  opponentCell?: Cell,
  phantomCell: Cell = PHANTOM_MARKER,
  drawPhantomMarker = false
): void {
  const gridCenters = centers()
  const highlightedIndex =
    opponentCell !== undefined
      ? opponentCell.i * GRID_SIZE + opponentCell.j
      : -1

  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  ctx.fillStyle = "#f1ead0"
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

  ctx.strokeStyle = "rgb(102, 102, 102)"
  ctx.fillStyle = "rgb(254, 204, 102)"
  ctx.lineJoin = "round"
  ctx.lineWidth = 2

  gridCenters.forEach((point, index) => {
    ctx.fillStyle =
      index === highlightedIndex ? OPPONENT_CELL_COLOR : "rgb(254, 204, 102)"
    drawPolygon(ctx, squarePoints(point))
  })

  gridCenters.forEach((point, index) => {
    const paletteIndex = highlightModifiedArrows
      ? Number(directionsState[index] !== defaultDirections[index])
      : 0
    drawArrow(ctx, point, directionsState[index], paletteIndex)
  })

  drawMarker(ctx, markerCell)

  if (drawPhantomMarker) {
    drawMarkerUnfilled(ctx, phantomCell)
  }
}

export function renderCompassReadingSquare(
  ctx: CanvasRenderingContext2D,
  direction: Direction,
  backgroundColor = "#000000"
): void {
  const canvasWidth = ctx.canvas.width
  const canvasHeight = ctx.canvas.height
  const squareX = (canvasWidth - READING_SQUARE_SIZE) / 2
  const squareY = (canvasHeight - READING_SQUARE_SIZE) / 2

  ctx.clearRect(0, 0, canvasWidth, canvasHeight)
  ctx.fillStyle = backgroundColor
  ctx.fillRect(squareX, squareY, READING_SQUARE_SIZE, READING_SQUARE_SIZE)

  drawArrow(
    ctx,
    { x: canvasWidth / 2, y: canvasHeight / 2 },
    direction,
    0,
    {
      color: "#ffffff",
      arrowScale: READING_ARROW_SCALE,
      headLength: READING_HEAD_LENGTH,
      lineWidth: READING_LINE_WIDTH,
    }
  )
}

export function isPointInCompassReadingSquare(
  point: Point,
  canvasWidth: number,
  canvasHeight: number
): boolean {
  const squareX = (canvasWidth - READING_SQUARE_SIZE) / 2
  const squareY = (canvasHeight - READING_SQUARE_SIZE) / 2

  return (
    point.x >= squareX &&
    point.x <= squareX + READING_SQUARE_SIZE &&
    point.y >= squareY &&
    point.y <= squareY + READING_SQUARE_SIZE
  )
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
  paletteIndex = 0,
  options: ArrowOptions = {}
): void {
  const dir = directions[directionIndex]
  const arrowScale = options.arrowScale ?? ARROW_SCALE
  const headLength = options.headLength ?? CELL_SIZE * 0.14
  const lineWidth = options.lineWidth ?? 3
  const strokeColor = options.color ?? arrowColors[paletteIndex as 0 | 1]
  const dx = dir.x * arrowScale
  const dy = dir.y * arrowScale
  const from = { x: center.x - dx, y: center.y - dy }
  const to = { x: center.x + dx, y: center.y + dy }
  const angle = Math.atan2(to.y - from.y, to.x - from.x)

  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = lineWidth
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
  ctx.fillStyle = strokeColor
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

function drawMarkerUnfilled(
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
  ctx.strokeStyle = MARKER_COLOR
  ctx.lineWidth = 2
  ctx.stroke()
}

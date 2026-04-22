import { useEffect, useRef } from "react"
import {
  CANVAS_SIZE,
  findCellIndex,
  renderGrid,
  type Cell,
  type DirectionsState,
} from "../compass"

type CompassCanvasProps = {
  directions: DirectionsState
  onCellClick: (index: number) => void
  highlightModifiedArrows?: boolean
  markerCell?: Cell
}

export function CompassCanvas({
  directions,
  onCellClick,
  highlightModifiedArrows = true,
  markerCell,
  phantomCell,
  drawPhantomMarker = false
}: CompassCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")

    if (!canvas || !ctx) {
      return
    }

    renderGrid(ctx, directions, highlightModifiedArrows, markerCell, phantomCell, drawPhantomMarker)
  }, [directions, highlightModifiedArrows, markerCell])

  function handleCanvasClick(event: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const point = {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    }
    const cellIndex = findCellIndex(point)

    if (cellIndex === -1) {
      return
    }

    onCellClick(cellIndex)
  }

  return (
    <canvas
      ref={canvasRef}
      className="compass-canvas"
      width={CANVAS_SIZE}
      height={CANVAS_SIZE}
      aria-label="Grid of squares with directional arrows"
      onClick={handleCanvasClick}
    />
  )
}

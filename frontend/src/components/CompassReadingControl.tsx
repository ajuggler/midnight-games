import { useEffect, useRef, useState } from "react"
import {
  READING_SQUARE_SIZE,
  isPointInCompassReadingSquare,
  renderCompassReadingSquare,
  type Direction,
} from "../compass"

const READING_CANVAS_SIZE = Math.ceil(READING_SQUARE_SIZE + 28)

type CompassReadingControlProps = {
  isSubmitting: boolean
  onSubmitReading: (direction: Direction) => void
  onSubmitChallenge: () => void
  showChallenge: boolean
}

export function CompassReadingControl({
  isSubmitting,
  onSubmitReading,
  onSubmitChallenge,
  showChallenge,
}: CompassReadingControlProps) {
  const [direction, setDirection] = useState<Direction>(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")

    if (!canvas || !ctx) {
      return
    }

    renderCompassReadingSquare(ctx, direction)
  }, [direction])

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

    if (!isPointInCompassReadingSquare(point, canvas.width, canvas.height)) {
      return
    }

    setDirection((currentDirection) => ((currentDirection + 1) % 4) as Direction)
  }

  return (
    <div className="reading-panel">
      <p className="reading-label">Compass reading</p>
      <canvas
        ref={canvasRef}
        className="reading-canvas"
        width={READING_CANVAS_SIZE}
        height={READING_CANVAS_SIZE}
        aria-label="Compass reading selector"
        onClick={handleCanvasClick}
      />
      <button
        type="button"
        className="button primary"
        disabled={isSubmitting}
        onClick={() => onSubmitReading(direction)}
      >
        {isSubmitting ? "Submitting..." : "accept & submit"}
      </button>
      {showChallenge ? (
        <button
          type="button"
          className="button primary"
          disabled={isSubmitting}
          onClick={() => onSubmitChallenge()}
        >
          {isSubmitting ? "Submitting..." : "challenge"}
        </button>
      ) : null}
    </div>
  )
}

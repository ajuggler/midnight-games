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
  isTurnActive: boolean
  proofDirection?: Direction
  onSubmitReading: (direction: Direction) => void
  onSubmitChallenge: () => void
  onSubmitProof: () => void
  showChallenge: boolean
}

export function CompassReadingControl({
  isSubmitting,
  isTurnActive,
  proofDirection,
  onSubmitReading,
  onSubmitChallenge,
  onSubmitProof,
  showChallenge,
}: CompassReadingControlProps) {
  const [direction, setDirection] = useState<Direction>(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDisabled = isSubmitting || !isTurnActive
  const isProofMode = proofDirection !== undefined
  const displayedDirection = proofDirection ?? direction

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")

    if (!canvas || !ctx) {
      return
    }

    renderCompassReadingSquare(
      ctx,
      displayedDirection,
      isProofMode ? "rgb(128, 0, 2)" : undefined
    )
  }, [displayedDirection, isProofMode])

  function handleCanvasClick(event: React.MouseEvent<HTMLCanvasElement>) {
    if (!isTurnActive || isProofMode) {
      return
    }

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
    <div className={`reading-panel${!isTurnActive ? " reading-panel-disabled" : ""}`}>
      <p className="reading-label">{isProofMode ? "You've been challenged!" : "Compass reading"}</p>
      <canvas
        ref={canvasRef}
        className={`reading-canvas${isProofMode ? " reading-canvas-fixed" : ""}`}
        width={READING_CANVAS_SIZE}
        height={READING_CANVAS_SIZE}
        aria-label="Compass reading selector"
        onClick={handleCanvasClick}
      />
      {isProofMode ? (
        <button
          type="button"
          className={`button primary${!isTurnActive ? " turn-disabled" : ""}`}
          disabled={isDisabled}
          onClick={onSubmitProof}
        >
          {isSubmitting ? "Submitting..." : "prove"}
        </button>
      ) : (
        <>
          <button
            type="button"
            className={`button primary${!isTurnActive ? " turn-disabled" : ""}`}
            disabled={isDisabled}
            onClick={() => onSubmitReading(direction)}
          >
            {isSubmitting
              ? "Submitting..."
              : showChallenge
                ? "accept & submit"
                : "submit"}
          </button>
          {showChallenge ? (
            <button
              type="button"
              className={`button primary${!isTurnActive ? " turn-disabled" : ""}`}
              disabled={isDisabled}
              onClick={() => onSubmitChallenge()}
            >
              {isSubmitting ? "Submitting..." : "challenge"}
            </button>
          ) : null}
        </>
      )}
    </div>
  )
}

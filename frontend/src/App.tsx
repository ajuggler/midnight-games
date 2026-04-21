import { useState } from "react"
import { CompassCanvas } from "./components/CompassCanvas"
import {
  countModifiedArrows,
  createInitialDirections,
  cycleDirectionAt,
  gridFromDirections,
  MAX_MODIFIED_ARROWS,
  type DirectionsState,
} from "./compass"

type RequestStatus = "idle" | "loading" | "success" | "error"

type JoinResponse = {
  slot: "A" | "B"
  phase: {
    tag: string
  }
}

type ApiError = {
  error?: string
}

export default function App() {
  const [directions, setDirections] = useState<DirectionsState>(() =>
    createInitialDirections()
  )
  const [nickname, setNickname] = useState("")
  const [joinStatus, setJoinStatus] = useState<RequestStatus>("idle")
  const [submitGridStatus, setSubmitGridStatus] = useState<RequestStatus>("idle")
  const [resetStatus, setResetStatus] = useState<RequestStatus>("idle")
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  async function handleJoin() {
    setJoinStatus("loading")
    setSubmitGridStatus("idle")
    setResetStatus("idle")
    setMessage("")
    setErrorMessage("")

    try {
      const response = await fetch("/join", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nickname }),
      })

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => ({}))) as ApiError
        throw new Error(errorPayload.error ?? "Unable to join the game")
      }

      const payload = (await response.json()) as JoinResponse
      setJoinStatus("success")
      setMessage(`Joined as player ${payload.slot} (${payload.phase.tag}).`)
    } catch (error) {
      setJoinStatus("error")
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to join the game"
      )
    }
  }

  async function handleSubmitGrid() {
    setSubmitGridStatus("loading")
    setJoinStatus("idle")
    setResetStatus("idle")
    setMessage("")
    setErrorMessage("")

    try {
      const response = await fetch("/submitGrid", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          directions_grid: gridFromDirections(directions),
        }),
      })

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => ({}))) as ApiError
        throw new Error(errorPayload.error ?? "Unable to submit the grid")
      }

      setSubmitGridStatus("success")
      setMessage("Grid submitted successfully.")
    } catch (error) {
      setSubmitGridStatus("error")
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to submit the grid"
      )
    }
  }

  async function handleForceReset() {
    setResetStatus("loading")
    setJoinStatus("idle")
    setSubmitGridStatus("idle")
    setMessage("")
    setErrorMessage("")

    try {
      const response = await fetch("/forcereset", {
        method: "POST",
        credentials: "include",
      })

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => ({}))) as ApiError
        throw new Error(errorPayload.error ?? "Unable to reset the game")
      }

      setResetStatus("success")
      setMessage("Game reset successfully.")
    } catch (error) {
      setResetStatus("error")
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to reset the game"
      )
    }
  }

  function handleCellClick(index: number) {
    setDirections((currentDirections) => cycleDirectionAt(currentDirections, index))
  }

  const modifiedCount = countModifiedArrows(directions)
  const isJoinBusy = joinStatus === "loading"
  const isSubmitBusy = submitGridStatus === "loading"
  const isResetBusy = resetStatus === "loading"
  const isBusy = isJoinBusy || isSubmitBusy || isResetBusy

  return (
    <main className="page">
      <section className="card">
        <div className="copy">
          <h1>Counterfeit Compass</h1>
          <p className="description">
            Click any square to rotate its arrow through the four compass
            directions, then join the game from the same page.
          </p>
          <p className="counter" aria-live="polite">
            Modified arrows: <span>{modifiedCount}</span>
          </p>
          <p className="legend">
            you may now modify up to {MAX_MODIFIED_ARROWS} directions
          </p>
        </div>

        <div className="join-panel">
          <label className="field" htmlFor="nickname">
            <span className="field-label">Nickname</span>
            <input
              id="nickname"
              name="nickname"
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="Enter your nickname"
              autoComplete="nickname"
            />
          </label>
          <button
            type="button"
            className="button primary"
            onClick={handleJoin}
            disabled={isBusy}
          >
            {isJoinBusy ? "Joining..." : "Join game"}
          </button>
        </div>

        <CompassCanvas directions={directions} onCellClick={handleCellClick} />

        <div className="board-actions">
          <button
            type="button"
            className="button primary"
            onClick={handleSubmitGrid}
            disabled={isBusy}
          >
            {isSubmitBusy ? "Submitting grid..." : "Submit grid"}
          </button>
        </div>

        <div className="status-panel" aria-live="polite">
          {message ? <p className="status-message success">{message}</p> : null}
          {errorMessage ? (
            <p className="status-message error">{errorMessage}</p>
          ) : null}
        </div>

        <div className="footer-actions">
          <button
            type="button"
            className="button secondary"
            onClick={handleForceReset}
            disabled={isBusy}
          >
            {isResetBusy ? "Resetting..." : "Force reset"}
          </button>
        </div>
      </section>
    </main>
  )
}

import { useEffect, useState } from "react"
import { CompassCanvas } from "./components/CompassCanvas"
import { CompassReadingControl } from "./components/CompassReadingControl"
import {
  cellFromPosition,
  CHARGE_SQUARE_SIZE,
  countModifiedArrows,
  createInitialDirections,
  cycleDirectionAt,
  futurePosition,
  gridFromDirections,
  MAX_MODIFIED_ARROWS,
  type Direction,
  type DirectionsState,
  type Position,
} from "./compass"

type RequestStatus = "idle" | "loading" | "success" | "error"
type PlayerSlot = "A" | "B"
type PhaseTag =
  | "StandBy"
  | "WaitingForSecondPlayer"
  | "WaitingForGridsSetup"
  | "InProgress"
  | "Finished"

type JoinResponse = {
  slot: PlayerSlot
  phase: {
    tag: PhaseTag
  }
}

type ApiError = {
  error?: string
}

type GameStateResponse = {
  phase:
    | {
        tag: Exclude<PhaseTag, "Finished">
      }
    | {
        tag: "Finished"
        winner: PlayerSlot
      }
  players: {
    A?: {
      nickname: string
    }
    B?: {
      nickname: string
    }
  }
  lastReadings: {
    A?: Direction
    B?: Direction
  }
  positions?: {
    A: Position
    B: Position
  }
  charges?: {
    A: number
    B: number
  }
}

function otherPlayer(player: PlayerSlot): PlayerSlot {
  return player === "A" ? "B" : "A"
}

export default function App() {
  const [directions, setDirections] = useState<DirectionsState>(() =>
    createInitialDirections()
  )
  const [nickname, setNickname] = useState("")
  const [chosenNickname, setChosenNickname] = useState(
    () => window.sessionStorage.getItem("player-nickname") ?? ""
  )
  const [playerSlot, setPlayerSlot] = useState<PlayerSlot | null>(() => {
    const storedSlot = window.sessionStorage.getItem("player-slot")
    return storedSlot === "A" || storedSlot === "B" ? storedSlot : null
  })
  const [phaseTag, setPhaseTag] = useState<PhaseTag | null>(null)
  const [winnerSlot, setWinnerSlot] = useState<PlayerSlot | null>(null)
  const [players, setPlayers] = useState<GameStateResponse["players"]>({
    A: undefined,
    B: undefined,
  })
  const [lastReadings, setLastReadings] = useState<GameStateResponse["lastReadings"]>({
    A: undefined,
    B: undefined
  })
  const [positions, setPositions] = useState<GameStateResponse["positions"]>()
  const [charges, setCharges] = useState<GameStateResponse["charges"]>()
  const [joinStatus, setJoinStatus] = useState<RequestStatus>("idle")
  const [submitGridStatus, setSubmitGridStatus] = useState<RequestStatus>("idle")
  const [submitReadingStatus, setSubmitReadingStatus] =
    useState<RequestStatus>("idle")
  const [resetStatus, setResetStatus] = useState<RequestStatus>("idle")
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  async function refreshPhaseTag() {
    try {
      const response = await fetch("/state", {
        credentials: "include",
      })

      if (!response.ok) {
        return
      }

      const payload = (await response.json()) as GameStateResponse
      setPhaseTag(payload.phase.tag)
      setWinnerSlot(payload.phase.tag === "Finished" ? payload.phase.winner : null)
      setPlayers(payload.players)
      setLastReadings(payload.lastReadings)
      setPositions(payload.positions)
      setCharges(payload.charges)
    } catch {
      // Keep the current UI state if polling fails temporarily.
    }
  }

  useEffect(() => {
    let isActive = true

    async function syncGameState() {
      try {
        const response = await fetch("/state", {
          credentials: "include",
        })

        if (!response.ok) {
          return
        }

        const payload = (await response.json()) as GameStateResponse
        if (isActive) {
          setPhaseTag(payload.phase.tag)
          setWinnerSlot(payload.phase.tag === "Finished" ? payload.phase.winner : null)
          setPlayers(payload.players)
	  setLastReadings(payload.lastReadings)
          setPositions(payload.positions)
          setCharges(payload.charges)
        }
      } catch {
        // Keep the current UI state if polling fails temporarily.
      }
    }

    void syncGameState()
    const intervalId = window.setInterval(() => {
      void syncGameState()
    }, 3000)

    return () => {
      isActive = false
      window.clearInterval(intervalId)
    }
  }, [])

  async function handleJoin() {
    setJoinStatus("loading")
    setSubmitGridStatus("idle")
    setSubmitReadingStatus("idle")
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
      setPlayerSlot(payload.slot)
      setChosenNickname(nickname)
      window.sessionStorage.setItem("player-slot", payload.slot)
      window.sessionStorage.setItem("player-nickname", nickname)
      setPhaseTag(payload.phase.tag)
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
    setSubmitReadingStatus("idle")
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
      void refreshPhaseTag()
    } catch (error) {
      setSubmitGridStatus("error")
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to submit the grid"
      )
    }
  }

  async function handleSubmitReading(direction: Direction) {
    setSubmitReadingStatus("loading")
    setJoinStatus("idle")
    setSubmitGridStatus("idle")
    setResetStatus("idle")
    setMessage("")
    setErrorMessage("")

    try {
      const response = await fetch("/reading", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "compass_reading",
          direction,
        }),
      })

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => ({}))) as ApiError
        throw new Error(errorPayload.error ?? "Unable to submit the reading")
      }

      setSubmitReadingStatus("success")
      setMessage("Compass reading submitted successfully.")
      void refreshPhaseTag()
    } catch (error) {
      setSubmitReadingStatus("error")
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to submit the reading"
      )
    }
  }

  // DEBUG
  async function handleForceReset() {
    setResetStatus("loading")
    setJoinStatus("idle")
    setSubmitGridStatus("idle")
    setSubmitReadingStatus("idle")
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
      setChosenNickname("")
      setPlayerSlot(null)
      setPhaseTag("StandBy")
      setWinnerSlot(null)
      setPlayers({
        A: undefined,
        B: undefined,
      })
      setPositions(undefined)
      setCharges(undefined)
      window.sessionStorage.removeItem("player-slot")
      window.sessionStorage.removeItem("player-nickname")
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
  const isSubmitReadingBusy = submitReadingStatus === "loading"
  const isResetBusy = resetStatus === "loading"
  const isBusy = isJoinBusy || isSubmitBusy || isSubmitReadingBusy || isResetBusy
  const isInProgress = phaseTag === "InProgress"
  const isFinished = phaseTag === "Finished"
  const showSetupSummary = !isInProgress && !isFinished
  const isReadingControlBusy = isSubmitReadingBusy || isResetBusy
  const shouldCleanJoinRegion =
    (playerSlot === "A" && phaseTag !== null && phaseTag !== "StandBy") ||
    (playerSlot === "B" &&
      phaseTag !== null &&
      phaseTag !== "StandBy" &&
      phaseTag !== "WaitingForSecondPlayer")
  const displayedNickname = chosenNickname || nickname
  const opponentSlot =
    playerSlot === "A" ? "B" : playerSlot === "B" ? "A" : null
  const myCharge = playerSlot ? charges?.[playerSlot] ?? 0 : 0
  const opponentCharge =
    opponentSlot ? charges?.[opponentSlot] ?? 0 : 0
  const opponentNickname =
    opponentSlot && players[opponentSlot]?.nickname
      ? players[opponentSlot].nickname.length <= 30
        ? players[opponentSlot].nickname
        : "Opponent"
      : "Opponent"
  const resultOpponentName =
    opponentSlot && players[opponentSlot]?.nickname
      ? players[opponentSlot].nickname.length <= 30
        ? players[opponentSlot].nickname
        : "Your opponent"
      : "Your opponent"
  const resultMessage =
    isFinished && winnerSlot
      ? winnerSlot === playerSlot
        ? "You Won!"
        : `${resultOpponentName} Won!`
      : null
  let markerCell: Cell | undefined;
  if (
    isInProgress &&
    playerSlot != null &&
    positions?.[playerSlot] != null
  ) {
    const currentPosition = positions[playerSlot];
    const opponent = otherPlayer(playerSlot);
    markerCell = (lastReadings?.[opponent] !== undefined)
      ? cellFromPosition(
	  futurePosition(currentPosition, lastReadings[opponent])
        )
      : cellFromPosition(currentPosition);
  }
  let phantomCell: Cell | undefined;
  if (
    isInProgress &&
    playerSlot != null &&
    positions?.[playerSlot] != null
  ) {
    phantomCell = (lastReadings?.[otherPlayer(playerSlot)] !== undefined)
      ? cellFromPosition(positions[playerSlot])
      : undefined
  }

  return (
    <main className="page">
      <section className="card">
      <h1>Counterfeit Compass</h1>
        <div className="join-panel">
          {shouldCleanJoinRegion ? (
            <p className="chosen-nickname">
              <span className="field-label">Nickname:</span>{" "}
              <span>{displayedNickname}</span>
            </p>
          ) : (
            <>
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
            </>
          )}
        </div>

        <div className="setup-summary">
          {showSetupSummary ? (
            <p className="description">
              Click any square to rotate its arrow through the four compass
              directions. You may modify up to {MAX_MODIFIED_ARROWS} directions.
              When you are done, submit your grid.
            </p>
          ) : null}
          {showSetupSummary ? (
            <p className="counter" aria-live="polite">
              Modified arrows: <span>{modifiedCount}</span>
            </p>
          ) : null}
        </div>

        {isInProgress || isFinished ? (
          <div className="charges-display">
            <p className="charges-title">CHARGES</p>
            <div className="charges-row">
              <div className="charge-entry">
                <span className="charge-label">Me:</span>
                <span
                  className="charge-square"
                  style={{ width: CHARGE_SQUARE_SIZE, height: CHARGE_SQUARE_SIZE }}
                >
                  {myCharge}
                </span>
              </div>
              <div className="charge-entry">
                <span className="charge-label">{opponentNickname}:</span>
                <span
                  className="charge-square"
                  style={{ width: CHARGE_SQUARE_SIZE, height: CHARGE_SQUARE_SIZE }}
                >
                  {opponentCharge}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {resultMessage ? (
          <div className="result-banner" role="status" aria-live="polite">
            {resultMessage}
          </div>
        ) : null}

        <div className={`play-surface${isInProgress ? " in-progress" : ""}`}>
          <CompassCanvas
            directions={directions}
            onCellClick={handleCellClick}
            highlightModifiedArrows={!isInProgress}
            markerCell={markerCell}
            phantomCell={phantomCell}
            drawPhantomMarker={lastReadings?.[otherPlayer(playerSlot)] !== undefined}
          />
          {isInProgress ? (
            <CompassReadingControl
              isSubmitting={isReadingControlBusy}
              onSubmit={handleSubmitReading}
            />
          ) : null}
        </div>

        {!isInProgress ? (
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
        ) : null}

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

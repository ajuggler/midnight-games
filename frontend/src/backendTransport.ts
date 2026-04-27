import { gridFromDirections, type Direction } from "./compass"
import type {
  ApiError,
  GameStateResponse,
  GameTransport,
  JoinGameInput,
  JoinResponse,
  SubmitGridInput,
} from "./gameTypes"

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

async function parseError(response: Response, fallback: string): Promise<Error> {
  const payload = (await response.json().catch(() => ({}))) as ApiError
  return new Error(payload.error ?? fallback)
}

async function fetchState(): Promise<GameStateResponse> {
  const response = await fetch("/state", {
    credentials: "include",
  })

  if (!response.ok) {
    throw await parseError(response, "Unable to fetch the game state")
  }

  return parseJson<GameStateResponse>(response)
}

async function joinGame(input: JoinGameInput): Promise<JoinResponse> {
  const response = await fetch("/join", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw await parseError(response, "Unable to join the game")
  }

  return parseJson<JoinResponse>(response)
}

async function submitGrid(input: SubmitGridInput): Promise<void> {
  const response = await fetch("/submitGrid", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      directions_grid: gridFromDirections(input.directions),
    }),
  })

  if (!response.ok) {
    throw await parseError(response, "Unable to submit the grid")
  }
}

async function submitReading(direction: Direction): Promise<void> {
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
    throw await parseError(response, "Unable to submit the reading")
  }
}

async function submitChallenge(): Promise<void> {
  const response = await fetch("/reading", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "challenge",
    }),
  })

  if (!response.ok) {
    throw await parseError(response, "Unable to submit the challenge")
  }
}

async function submitProof(): Promise<void> {
  const response = await fetch("/proof", {
    method: "POST",
    credentials: "include",
  })

  if (!response.ok) {
    throw await parseError(response, "Unable to submit the proof")
  }
}

async function resetGame(): Promise<void> {
  const response = await fetch("/reset", {
    method: "POST",
    credentials: "include",
  })

  if (!response.ok) {
    throw await parseError(response, "Unable to reset the game")
  }
}

async function forceReset(): Promise<void> {
  const response = await fetch("/forcereset", {
    method: "POST",
    credentials: "include",
  })

  if (!response.ok) {
    throw await parseError(response, "Unable to force reset the game")
  }
}

async function claimPot(): Promise<void> {
  throw new Error("Pot claiming only exists in Midnight mode.")
}

export function createBackendTransport(): GameTransport {
  return {
    mode: "backend",
    label: "Trusted backend mode",
    description:
      "The current Express referee remains active. Hidden boards still live on the server in this mode.",
    showsPrivateBoardNotice: false,
    canResetGame: true,
    canForceReset: true,
    canClaimPot: false,
    getState: fetchState,
    joinGame,
    submitGrid,
    submitReading,
    submitChallenge,
    submitProof,
    claimPot,
    resetGame,
    forceReset,
  }
}

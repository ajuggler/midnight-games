import type { Direction, DirectionsState, Position } from "./compass"

export type RequestStatus = "idle" | "loading" | "success" | "error"
export type TransportMode = "backend" | "midnight"
export type PlayerSlot = "A" | "B"
export type PhaseTag =
  | "StandBy"
  | "WaitingForSecondPlayer"
  | "WaitingForGridsSetup"
  | "InProgress"
  | "Finished"

export type JoinResponse = {
  slot: PlayerSlot
  phase: {
    tag: PhaseTag
  }
}

export type ApiError = {
  error?: string
}

export type GameStateResponse = {
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
  turn?: {
    player: PlayerSlot
    challenged: boolean
  }
}

export type JoinGameInput = {
  nickname: string
}

export type SubmitGridInput = {
  directions: DirectionsState
  playerSlot: PlayerSlot | null
}

export type GameTransport = {
  mode: TransportMode
  label: string
  description: string
  showsPrivateBoardNotice: boolean
  canResetGame: boolean
  canForceReset: boolean
  canClaimPot: boolean
  getState(): Promise<GameStateResponse>
  joinGame(input: JoinGameInput): Promise<JoinResponse>
  submitGrid(input: SubmitGridInput): Promise<void>
  submitReading(direction: Direction): Promise<void>
  submitChallenge(): Promise<void>
  submitProof(): Promise<void>
  claimPot(): Promise<void>
  resetGame(): Promise<void>
  forceReset(): Promise<void>
}

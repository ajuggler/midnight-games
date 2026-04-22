export type Phase =
  | { tag: "StandBy" }
  | { tag: "WaitingForSecondPlayer" }
  | { tag: "WaitingForGridsSetup" }
  | { tag: "InProgress" }
  | { tag: "Finished"; winner: "A" | "B" }

export type Player = "A" | "B"

export type PlayerSession = {
  slot: Player
  nickname: string
  sessionId: string
}

export type Direction = 0 | 1 | 2 | 3

export type DirectionsGrid = Direction[][]

export type Position = [number, number]
export type Vector = [number, number]

export type Grids = {
  A?: DirectionsGrid
  B?: DirectionsGrid
}

export type ReadyGrids = Record<Player, DirectionsGrid>

export type GameState = {
  phase: Phase
  players: {
    A?: PlayerSession
    B?: PlayerSession
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
  turn?: { player: Player; challenged: boolean }
}

export type ServerState = {
  game: GameState
  grids: Grids
}

export type JoinRequest = {
  nickname: string
  sessionId: string
}

export type JoinResult =
  | {
      ok: true
      state: ServerState
      session: PlayerSession
      assigned: { slot: Player; phase: Phase }
    }
  | { ok: false; status: number; error: string }

export type SubmitGridResult =
  | { ok: true; state: ServerState }
  | { ok: false; status: number; error: string }

export type ReadingPayload =
  | { type: "compass_reading"; direction: Direction }
  | { type: "challenge" }

export type ReadingResult =
  | { ok: true; state: ServerState }
  | { ok: false; status: number; error: string }

export type ProofResult =
  | { ok: true; state: ServerState }
  | { ok: false; status: number; error: string }

export type ResetResult =
  | { ok: true; state: ServerState }
  | { ok: false; status: number; error: string }

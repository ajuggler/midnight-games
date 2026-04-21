import type {
  Direction,
  DirectionsGrid,
  GameState,
  Grids,
  JoinRequest,
  JoinResult,
  Player,
  Position,
  ProofResult,
  ReadingPayload,
  ReadingResult,
  ReadyGrids,
  ResetResult,
  ServerState,
  SubmitGridResult,
  Vector,
} from "../types/game"

export function initialServerState(): ServerState {
  return {
    game: {
      phase: { tag: "StandBy" },
      players: {},
    },
    grids: {},
  }
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

function addVector(a: Position, b: Vector): Position {
  return [mod(a[0] + b[0], 5), mod(a[1] + b[1], 5)]
}

function otherPlayer(player: Player): Player {
  return player === "A" ? "B" : "A"
}

export function isDirection(value: unknown): value is Direction {
  return value === 0 || value === 1 || value === 2 || value === 3
}

export function isValidGrid(grid: unknown): grid is DirectionsGrid {
  return (
    Array.isArray(grid) &&
    grid.length === 5 &&
    grid.every(
      (row) =>
        Array.isArray(row) &&
        row.length === 5 &&
        row.every((value) => isDirection(value))
    )
  )
}

const directionAsVector: Record<Direction, Vector> = {
  0: [0, 1],
  1: [1, 0],
  2: [0, -1],
  3: [-1, 0],
}

const chargeLaw: Record<Direction, number> = {
  0: 2,
  1: 1,
  2: -1,
  3: 0,
}

function modifyCharge(charge: number, movement: number, gridDirection: number): number {
  const key = mod(gridDirection - movement, 4) as Direction
  const increase = chargeLaw[key]

  return Math.max(0, charge + increase)
}

function getReadyGrids(grids: Grids): ReadyGrids | null {
  if (!grids.A || !grids.B) {
    return null
  }

  return {
    A: grids.A,
    B: grids.B,
  }
}

function applyCompassReading(
  positions: { A: Position; B: Position },
  charges: { A: number; B: number },
  grids: ReadyGrids,
  reader: Player,
  movement: Direction
): {
  positions: { A: Position; B: Position }
  charges: { A: number; B: number }
} {
  const target = otherPlayer(reader)
  const currentPosition = positions[target]
  const currentCharge = charges[target]
  const newPosition = addVector(currentPosition, directionAsVector[movement])
  const [i, j] = newPosition
  const newDirection = grids[target][i][j]
  const newCharge = modifyCharge(currentCharge, movement, newDirection)

  return {
    positions: {
      ...positions,
      [target]: newPosition,
    },
    charges: {
      ...charges,
      [target]: newCharge,
    },
  }
}

export function joinGame(state: ServerState, request: JoinRequest): JoinResult {
  const { game, grids } = state

  if (!game.players.A) {
    const session = {
      slot: "A" as const,
      nickname: request.nickname,
      sessionId: request.sessionId,
    }
    const nextGame: GameState = {
      ...game,
      phase: { tag: "WaitingForSecondPlayer" },
      players: {
        ...game.players,
        A: session,
      },
    }

    return {
      ok: true,
      state: { game: nextGame, grids },
      session,
      assigned: { slot: session.slot, phase: nextGame.phase },
    }
  }

  if (!game.players.B) {
    const session = {
      slot: "B" as const,
      nickname: request.nickname,
      sessionId: request.sessionId,
    }
    const nextGame: GameState = {
      ...game,
      phase: { tag: "WaitingForGridsSetup" },
      players: {
        ...game.players,
        B: session,
      },
    }

    return {
      ok: true,
      state: { game: nextGame, grids },
      session,
      assigned: { slot: session.slot, phase: nextGame.phase },
    }
  }

  return { ok: false, status: 400, error: "Game is full" }
}

export function submitGrid(
  state: ServerState,
  player: Player,
  grid: DirectionsGrid
): SubmitGridResult {
  const { game, grids } = state

  if (game.phase.tag !== "WaitingForGridsSetup") {
    return { ok: false, status: 400, error: "Wrong phase" }
  }

  if (grids[player]) {
    return { ok: false, status: 400, error: "Grid already submitted" }
  }

  const nextGrids: Grids = {
    ...grids,
    [player]: grid,
  }

  const bothSubmitted = Boolean(nextGrids.A && nextGrids.B)

  if (!bothSubmitted) {
    return {
      ok: true,
      state: {
        game,
        grids: nextGrids,
      },
    }
  }

  const nextGame: GameState = {
    ...game,
    phase: { tag: "InProgress" },
    positions: {
      A: [2, 2],
      B: [2, 2],
    },
    charges: {
      A: 0,
      B: 0,
    },
    turn: {
      player: "A",
      challenged: false,
    },
  }

  return {
    ok: true,
    state: {
      game: nextGame,
      grids: nextGrids,
    },
  }
}

export function submitReading(
  state: ServerState,
  player: Player,
  payload: ReadingPayload
): ReadingResult {
  const { game, grids } = state

  if (game.phase.tag !== "InProgress") {
    return { ok: false, status: 400, error: "Game not in progress" }
  }

  if (!game.turn || game.turn.player !== player || game.turn.challenged) {
    return { ok: false, status: 400, error: "Not your turn" }
  }

  if (!game.positions || !game.charges) {
    return { ok: false, status: 500, error: "Corrupt game state" }
  }

  const readyGrids = getReadyGrids(grids)
  if (!readyGrids) {
    return { ok: false, status: 500, error: "Corrupt grid state" }
  }

  const opponent = otherPlayer(player)

  if (payload.type === "challenge") {
    const nextGame: GameState = {
      ...game,
      turn: {
        player: opponent,
        challenged: true,
      },
    }

    return {
      ok: true,
      state: { game: nextGame, grids },
    }
  }

  const updated = applyCompassReading(
    game.positions,
    game.charges,
    readyGrids,
    player,
    payload.direction
  )

  const winner = updated.charges[opponent] >= 7 ? opponent : undefined

  const nextGame: GameState =
    winner !== undefined
      ? {
          ...game,
          positions: updated.positions,
          charges: updated.charges,
          phase: { tag: "Finished", winner },
        }
      : {
          ...game,
          positions: updated.positions,
          charges: updated.charges,
          turn: {
            player: opponent,
            challenged: false,
          },
        }

  return {
    ok: true,
    state: { game: nextGame, grids },
  }
}

export function submitProof(
  state: ServerState,
  player: Player,
  zkProof: string
): ProofResult {
  const { game, grids } = state

  if (game.phase.tag !== "InProgress") {
    return { ok: false, status: 400, error: "Game not in progress" }
  }

  if (!game.turn || game.turn.player !== player || !game.turn.challenged) {
    return { ok: false, status: 400, error: "Not your turn / no challenge" }
  }

  if (!game.charges) {
    return { ok: false, status: 500, error: "Corrupt game state" }
  }

  const opponent = otherPlayer(player)

  if (zkProof === "valid proof") {
    const nextGame: GameState = {
      ...game,
      charges: {
        ...game.charges,
        [opponent]: Math.max(0, game.charges[opponent] - 3),
      },
      turn: {
        player: opponent,
        challenged: false,
      },
    }

    return {
      ok: true,
      state: { game: nextGame, grids },
    }
  }

  const nextGame: GameState = {
    ...game,
    phase: { tag: "Finished", winner: opponent },
  }

  return {
    ok: true,
    state: { game: nextGame, grids },
  }
}

export function resetGame(state: ServerState): ResetResult {
  if (state.game.phase.tag !== "Finished") {
    return {
      ok: false,
      status: 400,
      error: "Cannot reset game before it has finished",
    }
  }

  return {
    ok: true,
    state: initialServerState(),
  }
}

// DEBUG
export function forceResetGame(): { ok: true; state: ServerState } {
  return {
    ok: true,
    state: initialServerState(),
  }
}

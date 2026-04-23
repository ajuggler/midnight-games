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

const GRID_SIZE = 5;
const WIN_CHG = 5;

export function initialServerState(): ServerState {
  return {
    game: {
      phase: { tag: "StandBy" },
      players: {},
      lastReadings: {}
    },
    grids: {},
  }
}

// --------------------
// Pure helpers
// --------------------

function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

function addVector(a: Position, b: Vector): Position {
  return [mod(a[0] + b[0], GRID_SIZE), mod(a[1] + b[1], GRID_SIZE)]
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
    grid.length === GRID_SIZE &&
    grid.every(
      (row) =>
        Array.isArray(row) &&
        row.length === GRID_SIZE &&
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
  lastReadings: { A?: Direction, B?: Direction },
  positions: { A: Position; B: Position },
  charges: { A: number; B: number },
  grids: ReadyGrids,
  reader: Player
): {
  positions: { A: Position; B: Position }
  charges: { A: number; B: number }
} {
  const opponent = otherPlayer(reader)
  const movement = lastReadings[opponent]

  if (movement != null) {
    const currentPosition = positions[reader]
    const currentCharge = charges[reader]
    const newPosition = addVector(currentPosition, directionAsVector[movement])
    const [i, j] = newPosition
    const newDirection = grids[reader][i][j]
    const newCharge = modifyCharge(currentCharge, movement, newDirection)

    return {
      positions: {
	...positions,
	[reader]: newPosition,
      },
      charges: {
	...charges,
	[reader]: newCharge,
      },
    }
  }

  return {
    positions: positions,
    charges: charges
  }
}

function verifyCompassReading(
  positions: { A: Position; B: Position },
  grids: ReadyGrids,
  reader: Player,
  movement: Direction
): boolean {
  const grid = grids[reader];
  const [i, j] = positions[reader];

  const a = grid[i][mod(j + 1, GRID_SIZE)];
  const b = grid[mod(i + 1, GRID_SIZE)][j];
  const c = grid[i][mod(j - 1, GRID_SIZE)];
  const d = grid[mod(i - 1, GRID_SIZE)][j];
  const e = grid[i][j];

  const counts = [0, 0, 0, 0];

  for (const x of [a, b, c, d]) {
    counts[x]++;
  }

  let max1 = -1;
  let max2 = -1;
  let argmax: Direction = 0;

  for (let i = 0; i < 4; i++) {
    const count = counts[i];

    if (count > max1) {
      max2 = max1;
      max1 = count;
      argmax = i as Direction;
    } else if (count > max2) {
      max2 = count;
    }
  }

  const maxMov = max1 === max2 ? e : argmax;
  return (movement === maxMov)
}

// --------------------
// Pure reducers
// --------------------

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
    game.lastReadings,
    game.positions,
    game.charges,
    readyGrids,
    player
  )

  const updatedReadings = {
    ...game.lastReadings,
    [player]: payload.direction,
    [opponent]: undefined
  };

  const winner = updated.charges[player] >= WIN_CHG ? player : undefined

  const nextGame: GameState =
    winner !== undefined
      ? {
          ...game,
          lastReadings: {},
          positions: updated.positions,
          charges: updated.charges,
          phase: { tag: "Finished", winner },
        }
      : {
          ...game,
          lastReadings: updatedReadings,
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
  player: Player
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

  if (!game.positions) {
    return { ok: false, status: 500, error: "Corrupt game state" }
  }

  const challengedReading = game.lastReadings?.[player]
  if (challengedReading === undefined) {
    return { ok: false, status: 400, error: "No reading to prove" }
  }
  
  const readyGrids = getReadyGrids(grids)
  if (!readyGrids) {
    return { ok: false, status: 500, error: "Corrupt grid state" }
  }

  const opponent = otherPlayer(player)

  if (verifyCompassReading(
    game.positions,
    readyGrids,
    player,
    challengedReading
  )) {
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

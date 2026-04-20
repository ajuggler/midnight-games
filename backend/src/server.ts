import express from "express";
import session from "express-session";
import crypto from "crypto";

// --------------------
// Types
// --------------------

type Phase =
  | { tag: "StandBy" }
  | { tag: "WaitingForSecondPlayer" }
  | { tag: "WaitingForGridsSetup" }
  | { tag: "InProgress" }
  | { tag: "Finished"; winner: "A" | "B" };

type Player = "A" | "B";

type PlayerSession = {
  slot: Player;
  nickname: string;
  sessionId: string;
};

type Direction = 0 | 1 | 2 | 3; // 0=N, 1=E, 2=S, 3=W

type DirectionsGrid = Direction[][];

type Position = [number, number];
type Vector = [number, number];

type Grids = {
  A?: DirectionsGrid;
  B?: DirectionsGrid;
};

type GameState = {
  phase: Phase;
  players: {
    A?: PlayerSession;
    B?: PlayerSession;
  };
  positions?: {
    A: Position;
    B: Position;
  };
  charges?: {
    A: number;
    B: number;
  };
  turn?: { player: Player; challenged: boolean };
};

type ServerState = {
  game: GameState;
  grids: Grids;
};

type JoinResult =
  | { ok: true; state: ServerState; assigned: { slot: Player; phase: Phase } }
  | { ok: false; status: number; error: string };

type SubmitGridResult =
  | { ok: true; state: ServerState }
  | { ok: false; status: number; error: string };

type ReadingPayload =
  | { type: "compass_reading"; direction: Direction }
  | { type: "challenge" };

type ReadingResult =
  | { ok: true; state: ServerState }
  | { ok: false; status: number; error: string };

type ProofResult =
  | { ok: true; state: ServerState }
  | { ok: false; status: number; error: string };

type ResetResult =
  | { ok: true; state: ServerState }
  | { ok: false; status: number; error: string };

// --------------------
// Global server state
// --------------------

function initialServerState(): ServerState {
  return {
    game: {
      phase: { tag: "StandBy" },
      players: {},
    },
    grids: {},
  };
}

let serverState: ServerState = initialServerState();

const sessions = new Map<string, PlayerSession>();

// --------------------
// Session typing
// --------------------

declare module "express-session" {
  interface SessionData {
    sessionId?: string;
  }
}

// --------------------
// Math helpers
// --------------------

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function addVector(a: Position, b: Vector): Position {
  return [mod(a[0] + b[0], 4), mod(a[1] + b[1], 4)];
}

// --------------------
// Pure helpers
// --------------------

function otherPlayer(p: Player): Player {
  return p === "A" ? "B" : "A";
}

function isDirection(x: unknown): x is Direction {
  return x === 0 || x === 1 || x === 2 || x === 3;
}

function isValidGrid(grid: unknown): grid is DirectionsGrid {
  return (
    Array.isArray(grid) &&
    grid.length === 5 &&
    grid.every(
      (row) =>
        Array.isArray(row) &&
        row.length === 5 &&
        row.every((x) => isDirection(x))
    )
  );
}

const directionAsVector: Record<Direction, Vector> = {
  0: [0, 1],
  1: [1, 0],
  2: [0, -1],
  3: [-1, 0]
};

// If movement `m` arrives to direction `d`, key `d - m` determines
// charge increase/decrease.
const chargeLaw: Record<Direction, number> = {
  0: 2,
  1: 1,
  2: -1,
  3: 0
};

function modifyCharge(
  charge: number,
  mov: number,
  dirArrow: number
): number {
  const key = mod(dirArrow - mov, 4) as Direction;
  const inc = chargeLaw[key];

  return Math.max(0, charge + inc);
}

function applyCompassReading(
  positions: { A: Position; B: Position },
  charges: { A: number; B: number },
  grids: Grids,
  reader: Player,
  movement: Direction
): {
  positions: { A: Position; B: Position };
  charges: { A: number; B: number };
} {
  const target = otherPlayer(reader);
  const currentPosition = positions[target];
  const currentCharge = charges[target];
  const newPosition = addVector(currentPosition, directionAsVector(movement));
  const [i, j] = newPosition;
  const newDirection = grids[target][i][j];
  const newCharge = modifyCharge(currentCharge, movement, newDirection);

  return {
    positions: {
      ...positions,
      [target]: newPosition,
    },
    charges: {
      ...charges,
      [target]: newCharge
    }
  };
}

// --------------------
// Pure reducers
// --------------------

function joinGame(
  state: ServerState,
  playerSession: PlayerSession
): JoinResult {
  const { game, grids } = state;

  if (!game.players.A) {
    const nextGame: GameState = {
      ...game,
      phase: { tag: "WaitingForSecondPlayer" },
      players: {
        ...game.players,
        A: playerSession,
      },
    };

    return {
      ok: true,
      state: { game: nextGame, grids },
      assigned: { slot: "A", phase: nextGame.phase },
    };
  }

  if (!game.players.B) {
    const nextGame: GameState = {
      ...game,
      phase: { tag: "WaitingForGridsSetup" },
      players: {
        ...game.players,
        B: playerSession,
      },
    };

    return {
      ok: true,
      state: { game: nextGame, grids },
      assigned: { slot: "B", phase: nextGame.phase },
    };
  }

  return { ok: false, status: 400, error: "Game is full" };
}

function submitGrid(
  state: ServerState,
  player: Player,
  grid: DirectionsGrid
): SubmitGridResult {
  const { game, grids } = state;

  if (game.phase.tag !== "WaitingForGridsSetup") {
    return { ok: false, status: 400, error: "Wrong phase" };
  }

  if (grids[player]) {
    return { ok: false, status: 400, error: "Grid already submitted" };
  }

  const nextGrids: Grids = {
    ...grids,
    [player]: grid,
  };

  const bothSubmitted = Boolean(nextGrids.A && nextGrids.B);

  if (!bothSubmitted) {
    return {
      ok: true,
      state: {
        game,
        grids: nextGrids,
      },
    };
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
  };

  return {
    ok: true,
    state: {
      game: nextGame,
      grids: nextGrids,
    },
  };
}

function submitReading(
  state: ServerState,
  player: Player,
  payload: ReadingPayload
): ReadingResult {
  const { game, grids } = state;

  if (game.phase.tag !== "InProgress") {
    return { ok: false, status: 400, error: "Game not in progress" };
  }

  if (!game.turn || game.turn.player !== player || game.turn.challenged) {
    return { ok: false, status: 400, error: "Not your turn" };
  }

  if (!game.positions || !game.charges) {
    return { ok: false, status: 500, error: "Corrupt game state" };
  }

  const opponent = otherPlayer(player);

  if (payload.type === "challenge") {
    const nextGame: GameState = {
      ...game,
      turn: {
        player: opponent,
        challenged: true,
      },
    };

    return {
      ok: true,
      state: { game: nextGame, grids },
    };
  }

  const updated = applyCompassReading(
    game.positions,
    game.charges,
    grids,
    player,
    payload.direction
  );

  const winner =
    updated.charges[opponent] >= 7 ? opponent : undefined;

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
        };

  return {
    ok: true,
    state: { game: nextGame, grids },
  };
}

function submitProof(
  state: ServerState,
  player: Player,
  zkProof: string
): ProofResult {
  const { game, grids } = state;

  if (game.phase.tag !== "InProgress") {
    return { ok: false, status: 400, error: "Game not in progress" };
  }

  if (!game.turn || game.turn.player !== player || !game.turn.challenged) {
    return { ok: false, status: 400, error: "Not your turn / no challenge" };
  }

  if (!game.charges) {
    return { ok: false, status: 500, error: "Corrupt game state" };
  }

  const opponent = otherPlayer(player);

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
    };

    return {
      ok: true,
      state: { game: nextGame, grids },
    };
  }

  const nextGame: GameState = {
    ...game,
    phase: { tag: "Finished", winner: opponent },
  };

  return {
    ok: true,
    state: { game: nextGame, grids },
  };
}

function resetGame(state: ServerState): ResetResult {
  if (state.game.phase.tag !== "Finished") {
    return {
      ok: false,
      status: 400,
      error: "Cannot reset game before it has finished",
    };
  }

  return {
    ok: true,
    state: initialServerState(),
  };
}

// --------------------
// Imperative helpers
// --------------------

function generateSessionId(): string {
  return crypto.randomBytes(16).toString("hex");
}

function getPlayerSession(req: express.Request): PlayerSession | null {
  const sid = req.session.sessionId;
  if (!sid) return null;
  return sessions.get(sid) ?? null;
}

// --------------------
// App setup
// --------------------

const app = express();

app.use(express.json());

app.use(
  session({
    secret: "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // ToDo: set true in production over HTTPS
    },
  })
);

// --------------------
// Routes
// --------------------

app.post("/join", (req, res) => {
  const { nickname } = req.body as { nickname?: unknown };

  if (typeof nickname !== "string" || nickname.trim() === "") {
    return res.status(400).json({ error: "nickname required" });
  }

  const sessionId = generateSessionId();

  // Provisional slot; actual slot is set by reducer result.
  // We create the session object after deciding slot.
  const existingState = serverState;

  let slot: Player | null = null;
  if (!existingState.game.players.A) {
    slot = "A";
  } else if (!existingState.game.players.B) {
    slot = "B";
  } else {
    return res.status(400).json({ error: "Game is full" });
  }

  const playerSession: PlayerSession = {
    slot,
    nickname,
    sessionId,
  };

  const result = joinGame(existingState, playerSession);

  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }

  serverState = result.state;
  sessions.set(sessionId, playerSession);
  req.session.sessionId = sessionId;

  return res.json({
    slot: result.assigned.slot,
    phase: result.assigned.phase,
  });
});

app.post("/submitGrid", (req, res) => {
  const playerSession = getPlayerSession(req);
  if (!playerSession) {
    return res.status(401).json({ error: "Invalid session" });
  }

  const { directions_grid } = req.body as { directions_grid?: unknown };

  if (!isValidGrid(directions_grid)) {
    return res.status(400).json({ error: "Invalid grid" });
  }

  const result = submitGrid(serverState, playerSession.slot, directions_grid);

  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }

  serverState = result.state;
  return res.json({ ok: true });
});

app.post("/reading", (req, res) => {
  const playerSession = getPlayerSession(req);
  if (!playerSession) {
    return res.status(401).json({ error: "Invalid session" });
  }

  const body = req.body as unknown;

  let payload: ReadingPayload | null = null;

  if (
    typeof body === "object" &&
    body !== null &&
    "type" in body
  ) {
    const b = body as Record<string, unknown>;

    if (b.type === "challenge") {
      payload = { type: "challenge" };
    } else if (b.type === "compass_reading" && isDirection(b.direction)) {
      payload = {
        type: "compass_reading",
        direction: b.direction,
      };
    }
  }

  if (!payload) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const result = submitReading(serverState, playerSession.slot, payload);

  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }

  serverState = result.state;
  return res.json({ ok: true });
});

app.post("/proof", (req, res) => {
  const playerSession = getPlayerSession(req);
  if (!playerSession) {
    return res.status(401).json({ error: "Invalid session" });
  }

  const { zk_proof } = req.body as { zk_proof?: unknown };

  if (typeof zk_proof !== "string") {
    return res.status(400).json({ error: "zk_proof must be a string" });
  }

  const result = submitProof(serverState, playerSession.slot, zk_proof);

  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }

  serverState = result.state;
  return res.json({ ok: true });
});

app.post("/reset", (_req, res) => {
  const result = resetGame(serverState);

  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }

  serverState = result.state;
  sessions.clear();

  return res.json({ ok: true });
});

app.get("/state", (_req, res) => {
  // Public state only: no grids returned
  return res.json(serverState.game);
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

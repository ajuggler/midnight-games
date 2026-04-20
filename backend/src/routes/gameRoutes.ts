import { Router } from "express"

import {
  isDirection,
  isValidGrid,
  joinGame,
  resetGame,
  submitGrid,
  submitProof,
  submitReading,
} from "../logic/game"
import {
  clearSessions,
  getServerState,
  setServerState,
  setSession,
} from "../state/store"
import { generateSessionId, getPlayerSession } from "../session"
import type { ReadingPayload } from "../types/game"

function parseReadingPayload(body: unknown): ReadingPayload | null {
  if (typeof body !== "object" || body === null || !("type" in body)) {
    return null
  }

  const candidate = body as Record<string, unknown>

  if (candidate.type === "challenge") {
    return { type: "challenge" }
  }

  if (
    candidate.type === "compass_reading" &&
    isDirection(candidate.direction)
  ) {
    return {
      type: "compass_reading",
      direction: candidate.direction,
    }
  }

  return null
}

export function createGameRouter(): Router {
  const router = Router()

  router.post("/join", (req, res) => {
    const { nickname } = req.body as { nickname?: unknown }

    if (typeof nickname !== "string" || nickname.trim() === "") {
      return res.status(400).json({ error: "nickname required" })
    }

    const result = joinGame(getServerState(), {
      nickname,
      sessionId: generateSessionId(),
    })

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error })
    }

    setServerState(result.state)
    setSession(result.session)
    req.session.sessionId = result.session.sessionId

    return res.json({
      slot: result.assigned.slot,
      phase: result.assigned.phase,
    })
  })

  router.post("/submitGrid", (req, res) => {
    const playerSession = getPlayerSession(req)
    if (!playerSession) {
      return res.status(401).json({ error: "Invalid session" })
    }

    const { directions_grid } = req.body as { directions_grid?: unknown }

    if (!isValidGrid(directions_grid)) {
      return res.status(400).json({ error: "Invalid grid" })
    }

    const result = submitGrid(
      getServerState(),
      playerSession.slot,
      directions_grid
    )

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error })
    }

    setServerState(result.state)
    return res.json({ ok: true })
  })

  router.post("/reading", (req, res) => {
    const playerSession = getPlayerSession(req)
    if (!playerSession) {
      return res.status(401).json({ error: "Invalid session" })
    }

    const payload = parseReadingPayload(req.body as unknown)

    if (!payload) {
      return res.status(400).json({ error: "Invalid payload" })
    }

    const result = submitReading(getServerState(), playerSession.slot, payload)

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error })
    }

    setServerState(result.state)
    return res.json({ ok: true })
  })

  router.post("/proof", (req, res) => {
    const playerSession = getPlayerSession(req)
    if (!playerSession) {
      return res.status(401).json({ error: "Invalid session" })
    }

    const { zk_proof } = req.body as { zk_proof?: unknown }

    if (typeof zk_proof !== "string") {
      return res.status(400).json({ error: "zk_proof must be a string" })
    }

    const result = submitProof(getServerState(), playerSession.slot, zk_proof)

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error })
    }

    setServerState(result.state)
    return res.json({ ok: true })
  })

  router.post("/reset", (_req, res) => {
    const result = resetGame(getServerState())

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error })
    }

    setServerState(result.state)
    clearSessions()

    return res.json({ ok: true })
  })

  router.get("/state", (_req, res) => {
    return res.json(getServerState().game)
  })

  return router
}

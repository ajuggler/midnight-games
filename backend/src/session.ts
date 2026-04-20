import crypto from "crypto"
import session from "express-session"
import type { Request } from "express"

import { getSession } from "./state/store"
import type { PlayerSession } from "./types/game"

declare module "express-session" {
  interface SessionData {
    sessionId?: string
  }
}

export const sessionMiddleware = session({
  secret: "dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // ToDo: set true in production over HTTPS
  },
})

export function generateSessionId(): string {
  return crypto.randomBytes(16).toString("hex")
}

export function getPlayerSession(req: Request): PlayerSession | null {
  const sessionId = req.session.sessionId
  if (!sessionId) {
    return null
  }

  return getSession(sessionId)
}
